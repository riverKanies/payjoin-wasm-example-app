// Note: do not use JS new keyword on wasm classes, even if the class exposes a constructor called 'new', you access it with ObjName.new()

import {  Wallet, EsploraClient, ChangeSet, FeeRate, Recipient, Address, Amount } from 'bitcoindevkit';
import { Uri, Receiver } from 'payjoindevkit';


const network = "signet";

async function testPj() {

    const ohttpRelay = "https://pj.bobspacebkk.com";
    const payjoinDirectory = "https://payjo.in";
    const ohttpKeys = "OH1QYPM59NK2LXXS4890SUAXXYT25Z2VAPHP0X7YEYCJXGWAG6UG9ZU6NQ" // if these don't work you can get the new keys for the default gateway using payjoin-cli fetch-keys https://github.com/payjoin/rust-payjoin/pull/589


    const pjUriString = "bitcoin:tb1p6ah70934hd3ppw6f5j9der7vdgz2zz92nxcspyuxqcntqpgjny2se7mals?amount=0.00008&pjos=0&pj=HTTPS://PAYJO.IN/Q40QVRA849287%23RK1Q20SPY3G2Y0H6CKZX25ERJHDJ4HLETX3SC5UMZPKFJK0L73D2AY6G+OH1QYPM59NK2LXXS4890SUAXXYT25Z2VAPHP0X7YEYCJXGWAG6UG9ZU6NQ+EX1YL32GEC"

    const bip21Uri = Uri.parse(pjUriString);
    console.log(bip21Uri.address());

    const pjUri = bip21Uri.check_pj_supported();
    console.log(pjUri.pj_endpoint);

    // testing rust error handling: works as expected
        //not sure why Receiver errors don't work right
    // const brokenUri = Uri.parse("fake")
    // console.log(brokenUri.address());

    // for full usage example to work off, see rust-payjoin/payjoin/tests/integration.rs#v2_to_v2


    // init sender wallet
    const {senderWallet, receiverWallet} = await initSenderAndReceiverWallets();

    const receiver = Receiver.new(
        receiverWallet.reveal_next_address().address,
        network,
        payjoinDirectory,
        ohttpKeys,
        ohttpRelay,
        BigInt(3600)
    );
    console.log(receiver);
    console.log(receiver.to_json());
    // got the pj_uri for the sender to use:
    console.log(receiver.pj_uri())

    // create psbt for pj_uri
    const psbt = senderWallet.build_tx(
        new FeeRate(BigInt(4)),
        [new Recipient(Address.new(receiver.pj_uri().address, network),
            Amount.from_sat(BigInt(8000)))]
        );
    // tx_builder.fee_rate(FeeRate::from_sat_per_vb(4).unwrap());
    // tx_builder.add_recipient(faucet_address.script_pubkey(), send_amount);

    // let mut psbt = tx_builder.finish()?;
    // let finalized = wallet.sign(&mut psbt, SignOptions::default())?;
    // assert!(finalized);
}

testPj();

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
    console.log("Balance:", receiverWallet.balance().confirmed.to_sat());
    // console.log("New address:", receiverWallet.reveal_next_address().address);

    console.log("Sender syncing...");
    let sender_scan_request = senderWallet.start_full_scan();
    let sender_update = await client.full_scan(sender_scan_request, 5, 1);
    senderWallet.apply_update(sender_update);
    console.log("Balance:", senderWallet.balance().confirmed.to_sat());
    console.log("New address:", senderWallet.reveal_next_address().address);


    return {senderWallet, receiverWallet};
}


// simple string storage example
const Store = {
    save: data => {
        if (!data) {
            console.log("No data to save");
            return;
        }
        localStorage.setItem("walletData", data);  // data is already a JSON string
    },
    load: () => {
        return localStorage.getItem("walletData");  // return the JSON string directly
    }
}

const externalDescriptor = "tr([12071a7c/86'/1'/0']tpubDCaLkqfh67Qr7ZuRrUNrCYQ54sMjHfsJ4yQSGb3aBr1yqt3yXpamRBUwnGSnyNnxQYu7rqeBiPfw3mjBcFNX4ky2vhjj9bDrGstkfUbLB9T/0/*)#z3x5097m";
const internalDescriptor = "tr([12071a7c/86'/1'/0']tpubDCaLkqfh67Qr7ZuRrUNrCYQ54sMjHfsJ4yQSGb3aBr1yqt3yXpamRBUwnGSnyNnxQYu7rqeBiPfw3mjBcFNX4ky2vhjj9bDrGstkfUbLB9T/1/*)#n9r4jswr";

async function run() {    
    let walletDataString = Store.load();
    console.log("Wallet data:", walletDataString);

    let wallet;
    let client = new EsploraClient("https://mutinynet.com/api");
    if (!walletDataString) {
        console.log("Creating new wallet");
        wallet = Wallet.create(
            "signet",
            externalDescriptor,
            internalDescriptor
        );

        console.log("Performing Full Scan...");
        let full_scan_request = wallet.start_full_scan();
        let update = await client.full_scan(full_scan_request, 5, 1);
        wallet.apply_update(update);

        const stagedDataString = wallet.take_staged().to_json();
        console.log("Staged:", stagedDataString);

        Store.save(stagedDataString);
        console.log("Wallet data saved to local storage");
        walletDataString = stagedDataString;
    } else {
        console.log("Loading wallet");
        let changeSet = ChangeSet.from_json(walletDataString);
        wallet = Wallet.load(
            changeSet,
            externalDescriptor,
            internalDescriptor
        );

        console.log("Syncing...");
        let sync_request = wallet.start_sync_with_revealed_spks();
        let update = await client.sync(sync_request, 1);
        wallet.apply_update(update);

        const updateChangeSet = wallet.take_staged();
        if (updateChangeSet) {
            console.log("Update:", updateChangeSet.to_json());
            let currentChangeSet = ChangeSet.from_json(walletDataString);
            console.log("Current:", currentChangeSet.to_json());
            currentChangeSet.merge(updateChangeSet);
            console.log("Merged:", currentChangeSet.to_json());
            Store.save(currentChangeSet.to_json());
        }
    }

    // Test balance
    console.log("Balance:", wallet.balance().confirmed.to_sat());
    
    // Test address generation
    console.log("New address:", wallet.reveal_next_address().address);


    // handle merging
    walletDataString = Store.load();
    const updateChangeSet = wallet.take_staged();
    console.log("Update:", updateChangeSet.to_json());
    let currentChangeSet = ChangeSet.from_json(walletDataString);
    console.log("Current:", currentChangeSet.to_json());
    currentChangeSet.merge(updateChangeSet);
    console.log("Merged:", currentChangeSet.to_json());
    Store.save(currentChangeSet.to_json());
    console.log("new address saved");
}

// run().catch(console.error);




// to clear local storage:
// localStorage.removeItem("walletData");
