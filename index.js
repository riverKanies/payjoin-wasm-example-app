import {  Wallet, EsploraClient, ChangeSet } from 'bitcoindevkit';

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

run().catch(console.error);

// to clear local storage:
// localStorage.removeItem("walletData");
