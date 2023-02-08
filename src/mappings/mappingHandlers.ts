import {
  SubstrateExtrinsic,
  SubstrateEvent,
  SubstrateBlock,
} from "@subql/types";
import { TheaDeposit, TheaWithdrawal, Account } from "../types";
import { Balance, AccountId32, H256} from "@polkadot/types/interfaces";
import {u8, u128} from "@polkadot/types-codec"

const TheaEvents = {
  /// Deposit Approved event ( chain_id, recipient, asset_id, amount, tx_hash(foreign chain))
  DepositApproved: "DepositApproved",
  /// Deposit claimed event ( recipient, number of deposits claimed )
  DepositClaimed: "DepositClaimed",
  /// Withdrawal Queued ( beneficiary, assetId, amount )
  WithdrawalQueued:"WithdrawalQueued",
  /// Withdrawal Ready (Network id, Nonce, last_withdrawal )
  WithdrawalReady:"WithdrawalReady",
  /// Withdrawal Executed (Nonce, network, Tx hash )
  WithdrawalExecuted:"WithdrawalExecuted",
  /// Withdrawal Fee Set (NetworkId, Amount)
  WithdrawalFeeSet:"WithdrawalFeeSet"
}

const Status ={
  APPROVED :"APPROVED",
  CLAIMED : "CLAIMED",
}
export async function handleTheaEvents(event: SubstrateEvent): Promise<void> {
  const {
    event: {
      data, method, section
    },
  } = event;
  logger.info("THEA EVENT: " + JSON.stringify({method, section, data}));

  //deposit approved by thea relayers
  if(method === TheaEvents.DepositApproved){
    let [chain_id, recipient, asset_id, amount, tx_hash] = data;
    let depositRecord = new TheaDeposit((tx_hash as H256).toString());
    let accountRecord = await Account.get(recipient.toString())
    if(!accountRecord) {
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
  else if (method === TheaEvents.DepositClaimed){
    let [recipient, asset_id, amount, tx_hash] = data;
    let depositRecord = await TheaDeposit.get((tx_hash as H256).toString());
    depositRecord.status = Status.CLAIMED;
    await depositRecord.save();
  }
  else if (method === TheaEvents.WithdrawalQueued){
    let [user, beneficiary, asset_id, amount, withdrawal_nonce] = data;
    const id = user.toString() + withdrawal_nonce.toString()
    let withdrawalRecord = new TheaWithdrawal(id);
    withdrawalRecord.amount = (amount as Balance).toBigInt();
    withdrawalRecord.asset_id = (asset_id as u128).toBigInt();
    withdrawalRecord.fromId = user.toString();
    withdrawalRecord.toId = beneficiary.toString();
    await withdrawalRecord.save();
  }
  else if(method === TheaEvents.WithdrawalReady){
    let [network_id, nonce, last_withdrawal_address] = data;
    //TODO:
    // Query blockchain for addressees
    // append the last_withdrawal_address with the addresses fetched from blockchain
    // update the withdrawal status of all these to ready
  }
  else if(method === TheaEvents.WithdrawalExecuted){
    let [nonce, network_id, tx_hash] = data;
  }
  //Retrieve the record by its ID
  // const record = await StarterEntity.get(
  //   event.block.block.header.hash.toString()
  // );
  // record.field2 = account.toString();
  // //Big integer type Balance of a transfer event
  // record.field3 = (balance as Balance).toBigInt();
  // await record.save();
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
