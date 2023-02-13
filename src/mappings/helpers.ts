import {SubstrateBlock} from "@subql/types";
import {TheaWithdrawal} from "../types";
import {u128, u32, u8} from "@polkadot/types-codec";
import {Status} from "./types";

type WithdrawalStatusConfig = {
    network_id: string;
    nonce: string;
    status: keyof typeof Status;
    block: SubstrateBlock;
}
export const updateWithdrawalsStatus = async (params: WithdrawalStatusConfig) => {
    const {network_id, nonce, status, block} = params
    // Query blockchain for addressees
    const readyWithdrawals = await api.query.thea.readyWithdrawls(network_id.toString(), nonce.toString())
    const addresses: string[] = readyWithdrawals.map(elem => elem.beneficiary.toString())

    // update the withdrawal status of all these to ready
    const promises = addresses.map(async (addr, i) => {
        const index = addr + nonce.toString() + i.toString()
        const withdrawal = await TheaWithdrawal.get(index)
        if (!withdrawal) {
            const {amount, assetId, beneficiary, index, network} = readyWithdrawals[i];
            const id = getWithdrawalId({
                user: beneficiary.toString(),
                withdrawal_nonce: nonce.toString(),
                index: i.toString()
            })
            let withdrawalRecord = new TheaWithdrawal(id);
            withdrawalRecord.amount = (amount as u128).toBigInt();
            withdrawalRecord.asset_id = (assetId as u128).toBigInt();
            withdrawalRecord.fromId = beneficiary.toString();
            withdrawalRecord.toId = beneficiary.toString();
            withdrawalRecord.index = (index as u32).toString()
            withdrawalRecord.timestamp = block.timestamp.getTime().toString()
            withdrawalRecord.blockHash = block.block.hash.toString()
            withdrawalRecord.nonce = nonce.toString()
            withdrawalRecord.network_id= (network as u8).toNumber()
        }
        withdrawal.status = status
        await withdrawal.save()
    })
    await Promise.all(promises)
}

type GetWithdrawalIdParams = {
    user: string,
    withdrawal_nonce: string,
    index: string
}
export const getWithdrawalId = ({user, withdrawal_nonce, index}: GetWithdrawalIdParams) => {
    return user + withdrawal_nonce + index
}