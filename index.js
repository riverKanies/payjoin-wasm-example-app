// Note: do not use JS new keyword on wasm classes, even if the class exposes a constructor called 'new', you access it with ObjName.new()

import {  Wallet, EsploraClient, ChangeSet, FeeRate, Recipient, Address, Amount, Psbt } from 'bitcoindevkit';
import { Uri, Receiver, SenderBuilder, Sender, Request } from 'payjoindevkit';


const network = "signet";

// Some relays below. If you get a timeout error, try a different relay.
// const ohttpRelay = "https://pj.benalleng.com";
// const ohttpRelay = "https://ohttp.cakewallet.com";// down
const ohttpRelay = "https://pj.bobspacebkk.com";


// Note: ohttpkeys are the same for all three relays, guess they're specific to the endpoint only
const ohttpKeys = "OH1QYPJ8S50XG3XK8URWDQ5VKTD6SLSGGH0S6UQ63R93G9VKANS3EX4CZC"
// if these don't work you can get the new keys for the default gateway using payjoin-cli fetch-keys https://github.com/payjoin/rust-payjoin/pull/589

const payjoinDirectory = "https://payjo.in";


// RUN
main();

async function main() {
    const receiver = await createAndSavePjUriAndPsbt();
    const sendGetContext = await senderStep1();
    console.log("preparing for receiver to add inputTx", receiver, sendGetContext);
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
        return console.log('session failed', response);
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
    const addressInfo = receiverWallet.reveal_addresses_to("external", 2)[0]
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

    return receiver
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

    console.log("Sender syncing...");
    let sender_scan_request = senderWallet.start_full_scan();
    let sender_update = await client.full_scan(sender_scan_request, 5, 1);
    senderWallet.apply_update(sender_update);
    console.log("Balance:", senderWallet.balance.confirmed.to_sat());
    console.log("New address:", senderWallet.reveal_next_address().address.toString());


    return {senderWallet, receiverWallet};
}