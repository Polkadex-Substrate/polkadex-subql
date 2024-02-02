import {SubstrateEvent,} from "@subql/types";
import {Account, TheaDeposit, TheaWithdrawal} from "../types";
import {AccountId32, Balance} from "@polkadot/types/interfaces";
import {u128, u32, u8, Vec} from "@polkadot/types-codec"
import {Status} from "./types";

const TheaEvents = {
    /// Deposit Approved event ( Network, recipient, asset_id, amount, id))
    DepositApproved: "DepositApproved",
    /// Deposit claimed event ( recipient, asset id, amount, id )
    DepositClaimed: "DepositClaimed",
    /// Withdrawal Queued ( network, from, beneficiary, assetId, amount, id )
    WithdrawalQueued: "WithdrawalQueued",
    /// Withdrawal Ready (Network id )
    WithdrawalReady: "WithdrawalReady",
    /// Withdrawal Fee Set (NetworkId, Amount)
    WithdrawalFeeSet: "WithdrawalFeeSet"
}

export async function handleTheaEvents(event: SubstrateEvent): Promise<void> {
    logger.info("SUBSTRATE EVENT: " + JSON.stringify(event));
    const {
        event: {
            data, method, section
        },
        block
    } = event;
    logger.info("THEA EVENT: " + JSON.stringify({method, section, data}));

    //deposit approved by thea relayers
    if (method === TheaEvents.DepositApproved) {
        logger.info("debug: DepositApproved!");
        let [chain_id, recipient, asset_id, amount, id] = data;
        let accountRecord = await Account.get(recipient.toString())
        if (!accountRecord) {
            accountRecord = new Account(recipient.toString())
            await accountRecord.save()
        }
        let depositRecord = new TheaDeposit(
            (id as Vec<u8>).toString(),
            block.timestamp.getTime().toString(),
            block.block.hash.toString(),
            (chain_id as u8).toNumber(),
            (amount as Balance).toBigInt(),
            (asset_id as u128).toBigInt(),
            (recipient as AccountId32).toString(),
            (recipient as AccountId32).toString(),
            Status.READY,
        )
        await depositRecord.save();
    }

//Deposit is claimed on native chain
    else if (method === TheaEvents.DepositClaimed) {
        let [_recipient, _asset_id, _amount, id] = data;
        let depositRecord = await TheaDeposit.get((id as Vec<u8>).toString());
        if(!depositRecord){
            logger.info("cannot find DepositReady Record!", id);
            return;
        }
        depositRecord.status = Status.CLAIMED;
        await depositRecord.save();
    } else if (method === TheaEvents.WithdrawalQueued) {
        let [network_id, user, beneficiary, asset_id, amount, id] = data;
        const withdrawal_id = id.toString()
        let withdrawalRecord = new TheaWithdrawal(
            withdrawal_id,
            block.timestamp.getTime().toString(),
            block.block.hash.toString(),
            (network_id as u32).toNumber(),
            (amount as Balance).toBigInt(),
            (asset_id as u128).toBigInt(),
            beneficiary.toString(),
            user.toString(),
            Status.QUEUED,
        );
        await withdrawalRecord.save();

    } else if (method === TheaEvents.WithdrawalReady) {
        let [network_id] = data;
        const readyWithdrawals = await api.query.theaExecutor.readyWithdrawals(block.block.header.number, network_id.toString());
        logger.info("readyWithdrawals", readyWithdrawals)
        // @ts-ignore
        const promises = readyWithdrawals.map(async (e, _i) => {
            let record = await TheaWithdrawal.get(e.id.toString())
            if (!!record) {
                record.blockHash = block.block.hash.toString()
                record.status = Status.READY
                await record.save()
            }
        })
        await Promise.all(promises)
    } else {
        logger.info("UNKNOWN EVENT: THEAHANDLER: ", JSON.stringify(event))
    }
}
