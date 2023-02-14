import {SubstrateBlock} from "@subql/types";
import {TheaWithdrawal} from "../types";
import {u128, u32, u8} from "@polkadot/types-codec";
import {Status} from "./types";
import {encodeAddress} from "@polkadot/util-crypto";

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
    logger.info(JSON.stringify(readyWithdrawals))

    // update the withdrawal status of all these to ready
    const promises = addresses.map(async (addr, i) => {
        const index = addr + nonce.toString() + i.toString()
        let withdrawalRecord = await TheaWithdrawal.get(index)
        if (!withdrawalRecord) {
            const {amount, assetId, beneficiary, index, network} = readyWithdrawals[i];
            //FIXME: the address of the user should me emitter with the event/ added in ready storage.
            //should not be defaulted to the beneficiary address
            let user = encodeAddress(beneficiary.toString(), 88)
            const id = getWithdrawalId({
                user: user.toString(),
                withdrawal_nonce: nonce.toString(),
                index: i.toString()
            })
            withdrawalRecord = new TheaWithdrawal(id);
            withdrawalRecord.amount = (amount as u128).toBigInt();
            withdrawalRecord.asset_id = (assetId as u128).toBigInt();
            withdrawalRecord.fromId = user.toString();
            withdrawalRecord.toId = beneficiary.toString();
            withdrawalRecord.index = (index as u32).toString()
            withdrawalRecord.timestamp = block.timestamp.getTime().toString()
            withdrawalRecord.blockHash = block.block.hash.toString()
            withdrawalRecord.nonce = nonce.toString()
            withdrawalRecord.network_id= (network as u8).toNumber()
        }
        withdrawalRecord.status = status
        await withdrawalRecord.save()
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