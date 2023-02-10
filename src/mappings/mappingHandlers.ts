import {SubstrateEvent,} from "@subql/types";
import {Account, TheaDeposit, TheaWithdrawal} from "../types";
import {AccountId32, Balance, H256} from "@polkadot/types/interfaces";
import {u128, u32, u8} from "@polkadot/types-codec"

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

const Status = {
    APPROVED: "APPROVED",
    CLAIMED: "CLAIMED",
    READY: "READY",
    EXECUTED: "EXECUTED"
}

export async function handleTheaEvents(event: SubstrateEvent): Promise<void> {
    const {
        event: {
            data, method, section
        },
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
        await depositRecord.save();
    }
    //Deposit is claimed on native chain
    else if (method === TheaEvents.DepositClaimed) {
        let [recipient, asset_id, amount, tx_hash] = data;
        let depositRecord = await TheaDeposit.get((tx_hash as H256).toString());
        depositRecord.status = Status.CLAIMED;
        await depositRecord.save();
    } else if (method === TheaEvents.WithdrawalQueued) {
        let [user, beneficiary, asset_id, amount, withdrawal_nonce, index] = data;
        const id = user.toString() + withdrawal_nonce.toString() + index.toString()
        let withdrawalRecord = new TheaWithdrawal(id);
        withdrawalRecord.amount = (amount as Balance).toBigInt();
        withdrawalRecord.asset_id = (asset_id as u128).toBigInt();
        withdrawalRecord.fromId = user.toString();
        withdrawalRecord.toId = beneficiary.toString();
        withdrawalRecord.index = (index as u32).toString()
        await withdrawalRecord.save();
    } else if (method === TheaEvents.WithdrawalReady) {
        let [network_id, nonce] = data;
        await updateWithdrawalsStatus(network_id.toString(), nonce.toString(), "READY")
    } else if (method === TheaEvents.WithdrawalExecuted) {
        let [nonce, network_id, tx_hash] = data;
        await updateWithdrawalsStatus(network_id.toString(), nonce.toString(), "EXECUTED")
    }
}

const updateWithdrawalsStatus = async (network_id: string, nonce: string, status: keyof typeof Status) => {
    // Query blockchain for addressees
    const readyWithdrawals = await api.query.thea.readyWithdrawls(network_id.toString(), nonce.toString())
    const addresses: string[] = readyWithdrawals.map(elem => elem.beneficiary.toString())

    // update the withdrawal status of all these to ready
    const promises = addresses.map(async (addr, i) => {
        const index = addr + nonce.toString() + i.toString()
        const withdrawal = await TheaWithdrawal.get(index)
        withdrawal.status = status
        await withdrawal.save()
    })
    await Promise.all(promises)
}
//
// export async function handleCall(extrinsic: SubstrateExtrinsic): Promise<void> {
//   const record = await StarterEntity.get(
//     extrinsic.block.block.header.hash.toString()
//   );
//   //Date type timestamp
//   record.field4 = extrinsic.block.timestamp;
//   //Boolean tyep
//   record.field5 = true;
//   await record.save();
// }
