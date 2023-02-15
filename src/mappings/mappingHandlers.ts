import {SubstrateEvent,} from "@subql/types";
import {Account, TheaDeposit, TheaWithdrawal} from "../types";
import {AccountId32, Balance, H256} from "@polkadot/types/interfaces";
import {u128, u32, u8} from "@polkadot/types-codec"
import {Status} from "./types";
import {getWithdrawalId} from "./helpers";

const TheaEvents = {
    /// Deposit Approved event ( chain_id, recipient, asset_id, amount, tx_hash(foreign chain))
    DepositApproved: "DepositApproved",
    /// Deposit claimed event ( recipient, number of deposits claimed )
    DepositClaimed: "DepositClaimed",
    /// Withdrawal Queued ( beneficiary, assetId, amount )
    WithdrawalQueued: "WithdrawalQueued",
    /// Withdrawal Ready (Network id, Nonce, last_withdrawal )
    WithdrawalReady: "WithdrawalReady",
    /// Withdrawal Executed (Nonce, network, Tx hash )
    WithdrawalExecuted: "WithdrawalExecuted",
    /// Withdrawal Fee Set (NetworkId, Amount)
    WithdrawalFeeSet: "WithdrawalFeeSet"
}

export async function handleTheaEvents(event: SubstrateEvent): Promise<void> {
    const {
        event: {
            data, method, section
        },
        block
    } = event;
    logger.info("THEA EVENT: " + JSON.stringify({method, section, data}));

    //deposit approved by thea relayers
    if (method === TheaEvents.DepositApproved) {
        let [chain_id, recipient, asset_id, amount, tx_hash] = data;
        let depositRecord = new TheaDeposit((tx_hash as H256).toString());
        let accountRecord = await Account.get(recipient.toString())
        if (!accountRecord) {
            accountRecord = new Account(recipient.toString())
            await accountRecord.save()
        }
        depositRecord.amount = (amount as Balance).toBigInt();
        depositRecord.asset_id = (asset_id as u128).toBigInt();
        depositRecord.fromId = (recipient as AccountId32).toString();
        depositRecord.toId = (recipient as AccountId32).toString();
        depositRecord.network_id = (chain_id as u8).toNumber();
        depositRecord.status = Status.APPROVED
        depositRecord.timestamp = block.timestamp.getTime().toString()
        depositRecord.blockHash = block.block.hash.toString()
        await depositRecord.save();
    }
    //Deposit is claimed on native chain
    else if (method === TheaEvents.DepositClaimed) {
        let [recipient, asset_id, amount, tx_hash] = data;
        let depositRecord = await TheaDeposit.get((tx_hash as H256).toString());
        depositRecord.status = Status.CLAIMED;
        await depositRecord.save();
    } else if (method === TheaEvents.WithdrawalQueued) {
        let [network_id, user, beneficiary, asset_id, amount, withdrawal_nonce, index] = data;
        const id = getWithdrawalId({
            withdrawal_nonce: withdrawal_nonce.toString(),
            index: index.toString()
        })
        let withdrawalRecord = new TheaWithdrawal(id);
        withdrawalRecord.amount = (amount as Balance).toBigInt();
        withdrawalRecord.asset_id = (asset_id as u128).toBigInt();
        withdrawalRecord.fromId = user.toString();
        withdrawalRecord.toId = beneficiary.toString();
        withdrawalRecord.index = (index as u32).toString()
        withdrawalRecord.status = Status.QUEUED
        withdrawalRecord.timestamp = block.timestamp.getTime().toString()
        withdrawalRecord.blockHash = block.block.hash.toString()
        withdrawalRecord.nonce = withdrawal_nonce.toString()
        withdrawalRecord.network_id = (network_id as u32).toNumber()
        await withdrawalRecord.save();

    } else if (method === TheaEvents.WithdrawalReady) {
        let [network_id, nonce] = data;
        const readyWithdrawals = await api.query.thea.readyWithdrawls(network_id.toString(), nonce.toString());
        const promises = readyWithdrawals.map(async (e, i) => {
            let record = await TheaWithdrawal.get(getWithdrawalId({
                withdrawal_nonce: nonce.toString(),
                index: i.toString()
            }))
            if (!!record) {
                record.blockHash = block.block.hash.toString()
                record.status = Status.READY
                await record.save()
            }
        })
        await Promise.all(promises)
    } else if (method === TheaEvents.WithdrawalExecuted) {
        let [nonce, network_id, tx_hash] = data;
        //what fetch first withdrawal and get the block hash?

    }
}
