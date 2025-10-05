import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { ErPyth } from "../target/types/er_pyth";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import {
  GetCommitmentSignature,
  MAGIC_CONTEXT_ID,
  MAGIC_PROGRAM_ID
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { sendMagicTransaction, getClosestValidator } from "magic-router-sdk";
import { web3 } from "@coral-xyz/anchor";

describe("er_pyth", () => {
  let provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider);

  const program = anchor.workspace.erPyth as Program<ErPyth>;

  const SOLUSDC = new PublicKey("7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE");

  const routerConnection = new web3.Connection(
    process.env.ROUTER_ENDPOINT || "https://devnet-router.magicblock.app",
    {
      wsEndpoint: process.env.ROUTER_WS_ENDPOINT || "wss://devnet-router.magicblock.app",
    }
  );

  let priceAccountInfo: PublicKey;

  before(async () => {
    [priceAccountInfo] = PublicKey.findProgramAddressSync(
      [Buffer.from("price_account")],
      program.programId
    );
  })

  it("Is initialized!", async () => {
    const tx = await program.methods.initialize().rpc();
    console.log("Your transaction signature", tx);
  });

  it("fetch sol price", async () => {
    const tx = await program.methods.fetchPrice().accountsPartial({
      signer: provider.wallet.publicKey,
      priceUpdateAccount: SOLUSDC,
    }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`);
  });

  it("Initialize Price Account", async () => {
    const tx = await program.methods.initializePriceAccount().accountsPartial({
      signer: provider.wallet.publicKey,
      priceAccountInfo: priceAccountInfo,
      systemProgram: SystemProgram.programId,
    }).signers([provider.wallet.payer]).rpc();

    console.log(`Transaction Signature: ${tx}`)
  });

  it("Fetch Price 30 Times on Regular Devnet", async () => {
    const iterations = 30;
    const startTime = Date.now();

    console.log(`Starting to fetch price ${iterations} times on Regular Devnet...`);

    for (let i = 0; i < iterations; i++) {
      const iterationStart = Date.now();
      
      const tx = await program.methods.fetchPrice().accountsPartial({
        signer: provider.wallet.publicKey,
        priceUpdateAccount: SOLUSDC,
      }).signers([provider.wallet.payer]).rpc();

      const iterationEnd = Date.now();
      const iterationDuration = iterationEnd - iterationStart;

      console.log(`Iteration ${i + 1}: Signature: ${tx}, Duration: ${iterationDuration}ms`);
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log(`\n===== Regular Devnet Performance Summary =====`);
    console.log(`Total iterations: ${iterations}`);
    console.log(`Total duration: ${totalDuration}ms`);
    console.log(`Average duration per fetch: ${(totalDuration / iterations).toFixed(2)}ms`);
    console.log(`==============================================\n`);
  });

  it("Delegate Price Account", async () => {
    let validatorKey = await getClosestValidator(routerConnection);
    let commitFrequency = 30000;

    const tx = await program.methods.delegatePriceAccount(commitFrequency, validatorKey).accountsPartial({
      payer: provider.wallet.publicKey,
      priceAccountInfo: priceAccountInfo
    }).transaction();

    const signature = await sendMagicTransaction(
      routerConnection,
      tx,
      [provider.wallet.payer],
    );

    await new Promise(resolve => setTimeout(resolve, 5000));

    console.log("Delegated Price Account");
    console.log("Delegation signature", signature);
  });

  it("Update Price ER", async () => {
    const tx = await program.methods.updatePriceEr().accountsPartial({
      sender: provider.wallet.publicKey,
      priceAccountInfo: priceAccountInfo,
      priceUpdateAccount: SOLUSDC
    }).transaction();

    const signature = await sendMagicTransaction(
      routerConnection,
      tx,
      [provider.wallet.payer]
    );

    console.log(`Price Update Transaction Signature: ${signature}`);
  });

  it("Fetch Price 30 Times on ER", async () => {
    const iterations = 30;
    const startTime = Date.now();

    console.log(`Starting to fetch price ${iterations} times on Ephemeral Rollup...`);

    for (let i = 0; i < iterations; i++) {
      const iterationStart = Date.now();
      
      const tx = await program.methods.fetchPrice().accountsPartial({
        signer: provider.wallet.publicKey,
        priceUpdateAccount: SOLUSDC,
      }).transaction();

      const signature = await sendMagicTransaction(
        routerConnection,
        tx,
        [provider.wallet.payer]
      );

      const iterationEnd = Date.now();
      const iterationDuration = iterationEnd - iterationStart;

      console.log(`Iteration ${i + 1}: Signature: ${signature}, Duration: ${iterationDuration}ms`);
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log(`\n===== Performance Summary =====`);
    console.log(`Total iterations: ${iterations}`);
    console.log(`Total duration: ${totalDuration}ms`);
    console.log(`Average duration per fetch: ${(totalDuration / iterations).toFixed(2)}ms`);
    console.log(`===============================\n`);
  });

  it("Commit and Undelegate Price Account", async () => {
    const tx = await program.methods.commitAndUndelegatePriceAccount().accountsPartial({
      payer: provider.wallet.publicKey,
      priceAccountInfo: priceAccountInfo
    }).transaction();

    const signature = await sendMagicTransaction(
      routerConnection,
      tx,
      [provider.wallet.payer]
    );

    console.log(`Transaction Signature: ${signature}`);
  })
});
