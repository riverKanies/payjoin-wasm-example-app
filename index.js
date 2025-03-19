// Note: do not use JS new keyword on wasm classes, even if the class exposes a constructor called 'new', you access it with ObjName.new()

import {  Wallet, EsploraClient, ChangeSet } from 'bitcoindevkit';
import { Uri, Receiver } from 'payjoindevkit';

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

    console.log('hi')
    const receiver = Receiver.new(
        bip21Uri.address(),
        "testnet",
        payjoinDirectory,
        ohttpKeys,
        ohttpRelay,
        BigInt(3600)
    );
    console.log(receiver);
    console.log(receiver.to_json());
}

testPj();


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
        let update = await client.full_scan(full_scan_request, 1);
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
