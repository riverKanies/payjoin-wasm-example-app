// Note: do not use JS new keyword on wasm classes, even if the class exposes a constructor called 'new', you access it with ObjName.new()

import {  Wallet, EsploraClient, ChangeSet, FeeRate, Recipient, Address, Amount, Psbt, SignOptions } from 'bitcoindevkit';
import { Uri, Receiver, SenderBuilder, Sender, Request, InputPair } from 'payjoindevkit';


const network = "signet";

// Some relays below. If you get a timeout error, try a different relay.
// const ohttpRelay = "https://pj.benalleng.com";
// const ohttpRelay = "https://ohttp.cakewallet.com";// down
const ohttpRelay = "https://pj.bobspacebkk.com";


// Note: ohttpkeys are the same for all three relays, guess they're specific to the endpoint only
const ohttpKeys = "OH1QYP87E2AVMDKXDTU6R25WCPQ5ZUF02XHNPA65JMD8ZA2W4YRQN6UUWG"
// if these don't work you can get the new keys for the default gateway using payjoin-cli fetch-keys https://github.com/payjoin/rust-payjoin/pull/589

const payjoinDirectory = "https://payjo.in";


// RUN
main();

async function main() {
    const {receiver, receiverWallet, senderWallet} = await createAndSavePjUriAndPsbt();
    const sendGetContext = await senderStep1();

    console.log("preparing for receiver to add inputTx", receiver, sendGetContext);

    const {request, client_response} = await receiver.extract_req(ohttpRelay);
    console.log("receiver extracted request", request);
    console.log("receiver extracted client_response", client_response);

    // get fallback psbt
    console.log(request);
    console.log(request.url);
    console.log(request.content_type);
    // console.log(request.body);
    const response = await fetch(request.url, {
        method: 'POST',
        headers: {
            'Content-Type': request.content_type
        },
        body: request.body//psbtString
    });
    console.log('fallback response', response);
    if (response.ok) {
        console.log('fallback success');
    } else {
        return console.log('fallback failed', response);
    }
    const result = await response.bytes();
    console.log(result);

    const proposal = await receiver.process_res(result, client_response);
    console.log(proposal);
    const maybeInputsOwned = proposal.check_broadcast_suitability(null, true)
    console.log(maybeInputsOwned);
    const maybeInputsSeen = maybeInputsOwned.check_inputs_not_owned((input) => {
        console.log(input);
        // need to actually confirm the sender input is not owned by receiver
        return false;
    })
    console.log(maybeInputsSeen);

    const outputsUnknown = maybeInputsSeen.check_no_inputs_seen_before((outpoint) => {
        console.log(outpoint);
        // need to actually confirm the output hasn't been seen before
        return false;
    })
    console.log(outputsUnknown);

    const wantsOutputs = outputsUnknown.identify_receiver_outputs((outputScript) => {
        console.log(outputScript);
        // need to actually confirm the output is owned by receiver
        return true;
    })
    console.log(wantsOutputs);

    const wantsInputs = wantsOutputs.commit_outputs()
    console.log(wantsInputs);

    const inputs = receiverWallet.list_unspent().map((utxo) => createInputPairWithTx(utxo))
    console.log(inputs);

    const provisionalProposal = wantsInputs.contribute_inputs(inputs).commit_inputs()
    console.log(provisionalProposal);

    const payjoinProposal = provisionalProposal.finalize_proposal(
        (psbt) => {
            console.log('signing receiver inputs', psbt);
            // final check
            const psbtObj = Psbt.from_string(psbt)
            console.log(psbtObj);
            console.log(psbtObj.to_json());
            console.log(receiverWallet)
            try {
                const options = new SignOptions()
                console.log(options)
                options.trust_witness_utxo = true
                receiverWallet.sign_with_options(psbtObj, options);
            } catch (e) {
                console.error('sign err', e);
            }
            console.log('signed', psbtObj);
            return psbtObj.toString()
        },
        BigInt(1),
        BigInt(2)
    )

    let { request: finalRequest, client_response: finalContext } = payjoinProposal.extract_v2_req(ohttpRelay);
    let responsePayjoin = await fetch(finalRequest.url, {
        method: 'POST',
        headers: {
            'Content-Type': finalRequest.content_type
        },
        body: finalRequest.body
    });
    console.log('finalized', responsePayjoin);
    if (responsePayjoin.ok) {
        console.log('final proposal submitted success');
    } else {
        throw('finalized submition failed', responsePayjoin);
    }
    const responseData = await responsePayjoin.bytes();
    await payjoinProposal.process_res(responseData, finalContext);// what does this do?

    senderStep2(senderWallet, sendGetContext);
}

function createInputPairWithTx(utxo) {
    return InputPair.new(
        utxo.outpoint.txid.toString(), // Txid to string
        utxo.outpoint.vout, // number
        BigInt(utxo.txout.value.to_sat()), // Amount to satoshis (bigint)
        utxo.txout.script_pubkey.as_bytes() // ScriptBuf as bytes
    )
}

async function senderStep2(senderWallet, sendGetContext) {
    // SENDER STEP 2
    console.log('sender step 2', sendGetContext);
    const res = await sendGetContext.extract_req(ohttpRelay);
    console.log(res);
    const {request, ohttp_ctx} = res
    console.log(request, request.url, request.content_type, request.body);
    console.log(ohttp_ctx);
    const response = await fetch(request.url, {
        method: 'POST',
        headers: {
            'Content-Type': request.content_type
        },
        body: request.body
    })
    console.log('sender step 2', response);
    const result = await response.bytes();
    const checkedPayjoinProposalPsbt = sendGetContext.process_response(result, ohttp_ctx);
    console.log(checkedPayjoinProposalPsbt);

    // Convert PSBT string to PSBT object
    let payjoinPsbt = Psbt.from_string(checkedPayjoinProposalPsbt);

    // Sign the PSBT with the wallet
    senderWallet.sign(payjoinPsbt);

    // Extract the final transaction
    let finalTx = payjoinPsbt.extract_tx();
    console.log("ready to broadcast", finalTx);

    const client = new EsploraClient("https://mutinynet.com/api");
    // const broadcasted = await client.broadcast(finalTx)
    // console.log("broadcasted", broadcasted);

    // a completed payjoin tx using this demo app:
    // https://mutinynet.com/tx/f90380bdb2284a7586a386017177257d2454aab100f2a21d5ed2a6e3baf48f6e
}

async function senderStep1() {
    const pjUriString = localStorage.getItem("pjUriString");
    const psbtString = localStorage.getItem("psbtString");

    const bip21Uri = Uri.parse(pjUriString);
    console.log(bip21Uri.address());
    const pjUri = bip21Uri.check_pj_supported();
    console.log(pjUri.as_string);

    const psbt = Psbt.from_string(psbtString);
    // console.log(psbt.to_json());

    const senderBuilder = SenderBuilder.from_psbt_and_uri(psbtString, pjUri);
    console.log(senderBuilder);
    const sender = senderBuilder.build_recommended(BigInt(4));
    console.log(sender);
    // getting context consumes the object, destructuring makes that seem natural
    const {request, context} = sender.extract_v2(ohttpRelay);
    console.log(request);
    console.log(request.url);
    console.log(request.content_type);
    // console.log(request.body);
    
    const response = await fetch(request.url, {
        method: 'POST',
        headers: {
            'Content-Type': request.content_type
        },
        body: request.body//psbtString
    });
    console.log('session', response);
    if (response.ok) {
        console.log('session start success');
    } else {
        console.log('session failed, check ohttp keys');
        throw('session failed', response);
    }
    const result = await response.bytes();
    console.log(result);

    // consumes post context
    const sendGetContext = context.process_response(result);
    console.log(sendGetContext);
    // throws error bc post context is consumed
    // const sendGetContext2 = context.process_response(result);
    // console.log(sendGetContext2);

    return sendGetContext;
}


async function createAndSavePjUriAndPsbt() {


    // for full usage example to work off, see rust-payjoin/payjoin/tests/integration.rs#v2_to_v2


    // init sender wallet
    const {senderWallet, receiverWallet} = await initSenderAndReceiverWallets();

    // const nextAddress = receiverWallet.reveal_next_address("external");
    // console.log("next address", nextAddress.index, nextAddress.address.toString());
    const addressInfo = receiverWallet.reveal_addresses_to("external", 3)[0]
    console.log("address #", addressInfo.index);
    const address = addressInfo.address.toString()

    const receiver = Receiver.new(
        address,
        network,
        payjoinDirectory,
        ohttpKeys,
        ohttpRelay
    );
    console.log(receiver);
    // console.log(receiver.to_json());
    // got the pj_uri for the sender to use:
    const pjUriString = receiver.pj_uri().as_string
    console.log(pjUriString)

    // create psbt for pj_uri
    const psbt = senderWallet.build_tx()
        .fee_rate(new FeeRate(BigInt(4)))
        .add_recipient(new Recipient(Address.from_string(receiver.pj_uri().address.toString(), network),
            Amount.from_sat(BigInt(8000))))
        .finish();
    console.log(psbt.fee_amount().to_sat());
    const psbtString = psbt.toString();
    console.log(psbtString);

    // save to local storage
    localStorage.setItem("psbtString", psbtString);
    localStorage.setItem("pjUriString", pjUriString);

    return {receiver, receiverWallet, senderWallet}
}


async function initSenderAndReceiverWallets() {
    // generated descriptors using book of bdk descriptor example
    const senderDescriptorExternal = "tr(tprv8ZgxMBicQKsPeAndhG7FXuuk57oVpo4Y7xtUitrJyBRFnBHCCpLQofZZ7EZWcwB3zo8BLsJe8Qo5HeShP2zFoMx1zAA8PGnNGbfPozA4SvX/86'/1'/0'/0/*)#kkng6m9y"
    const senderDescriptorInternal = "tr(tprv8ZgxMBicQKsPeAndhG7FXuuk57oVpo4Y7xtUitrJyBRFnBHCCpLQofZZ7EZWcwB3zo8BLsJe8Qo5HeShP2zFoMx1zAA8PGnNGbfPozA4SvX/86'/1'/0'/1/*)#8zkf8w4u"

    const receiverDescriptorExternal = "tr(tprv8ZgxMBicQKsPdXaSHpSS8nXLfpPunAfEEs7K86ESCroA95iZbaxYyxgqNYurfnA85rKf7fXpqTcgtWC3w8cssERRxZtMafDmrYgRfp12PZw/86'/1'/0'/0/*)#vjm92l0u"
    const receiverDescriptorInternal = "tr(tprv8ZgxMBicQKsPdXaSHpSS8nXLfpPunAfEEs7K86ESCroA95iZbaxYyxgqNYurfnA85rKf7fXpqTcgtWC3w8cssERRxZtMafDmrYgRfp12PZw/86'/1'/0'/1/*)#ax7yh2ly"

    const senderWallet = Wallet.create(network, senderDescriptorExternal, senderDescriptorInternal);
    const receiverWallet = Wallet.create(network, receiverDescriptorExternal, receiverDescriptorInternal);

    const client = new EsploraClient("https://mutinynet.com/api");
    // get sats from faucet: https://faucet.mutinynet.com/

    console.log("Receiver syncing...");
    let receiver_scan_request = receiverWallet.start_full_scan();
    let receiver_update = await client.full_scan(receiver_scan_request, 5, 1);
    receiverWallet.apply_update(receiver_update);
    console.log("Balance:", receiverWallet.balance.confirmed.to_sat());
    // console.log("New address:", receiverWallet.reveal_next_address().address);
    console.log("Transaction ID:", receiverWallet.list_unspent()[0].outpoint.txid.toString());

    console.log("Sender syncing...");
    let sender_scan_request = senderWallet.start_full_scan();
    let sender_update = await client.full_scan(sender_scan_request, 5, 1);
    senderWallet.apply_update(sender_update);
    console.log("Balance:", senderWallet.balance.confirmed.to_sat());
    console.log("New address:", senderWallet.reveal_next_address().address.toString());


    return {senderWallet, receiverWallet};
}