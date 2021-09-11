#!/usr/bin/env node
import * as fs from 'fs';
import { program } from 'commander';
import * as anchor from '@project-serum/anchor';
import { LAMPORTS_PER_SOL } from '@solana/web3.js';

import { CACHE_PATH, TOKEN_PROGRAM_ID } from './helpers/constants';
import {
  loadFairLaunchProgram,
  loadWalletKey,
  getTokenMint,
  getFairLaunch,
  getTreasury,
} from './helpers/accounts';
program.version('0.0.1');

if (!fs.existsSync(CACHE_PATH)) {
  fs.mkdirSync(CACHE_PATH);
}

program
  .command('new_fair_launch')
  .option(
    '-e, --env <string>',
    'Solana cluster env name',
    'devnet', //mainnet-beta, testnet, devnet
  )
  .option(
    '-k, --keypair <path>',
    `Solana wallet location`,
    '--keypair not provided',
  )
  .option('-u, --uuid <string>', 'uuid')
  .option('-f, --fee <string>', 'price range end', '2')
  .option('-s, --price-range-start <string>', 'price range start', '1')
  .option('-e, --price-range-end <string>', 'price range end', '2')
  .option(
    '-pos, --phase-one-start-date <string>',
    'timestamp - eg "04 Dec 1995 00:12:00 GMT"',
  )
  .option(
    '-poe, --phase-one-end-date <string>',
    'timestamp - eg "04 Dec 1995 00:12:00 GMT"',
  )
  .option(
    '-pte, --phase-two-end-date <string>',
    'timestamp - eg "04 Dec 1995 00:12:00 GMT"',
  )
  .option('-ts, --tick-size <string>', 'tick size', '0.1')
  .option('-n, --number-of-tokens <number>', 'Number of tokens to sell')
  .option(
    '-mint, --token-mint <string>',
    'token mint to take as payment instead of sol',
  )
  .action(async (_, cmd) => {
    const {
      keypair,
      env,
      priceRangeStart,
      priceRangeEnd,
      phaseOneStartDate,
      phaseOneEndDate,
      phaseTwoEndDate,
      tickSize,
      numberOfTokens,
      fee,
      mint,
      uuid,
    } = cmd.opts();
    const parsedNumber = parseInt(numberOfTokens);
    let priceRangeStartNumber = parseFloat(priceRangeStart);
    let priceRangeEndNumber = parseFloat(priceRangeEnd);
    let tickSizeNumber = parseFloat(tickSize);
    let feeNumber = parseFloat(fee);
    const realUuid = uuid.slice(0, 6);
    const phaseOneStartDateActual =
      (phaseOneStartDate ? Date.parse(phaseOneStartDate) : Date.now()) / 1000;
    const phaseOneEndDateActual =
      (phaseOneEndDate ? Date.parse(phaseOneEndDate) : Date.now() + 86400000) /
      1000;
    const phaseTwoEndDateActual =
      (phaseTwoEndDate
        ? Date.parse(phaseTwoEndDate)
        : Date.now() + 2 * 86400000) / 1000;

    if (!mint) {
      priceRangeStartNumber = Math.ceil(
        priceRangeStartNumber * LAMPORTS_PER_SOL,
      );
      priceRangeEndNumber = Math.ceil(priceRangeEndNumber * LAMPORTS_PER_SOL);
      tickSizeNumber = Math.ceil(tickSizeNumber * LAMPORTS_PER_SOL);
      feeNumber = Math.ceil(feeNumber * LAMPORTS_PER_SOL);
    }

    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadFairLaunchProgram(walletKeyPair, env);
    const [tokenMint, tokenBump] = await getTokenMint(
      walletKeyPair.publicKey,
      realUuid,
    );
    const [fairLaunch, fairLaunchBump] = await getFairLaunch(tokenMint);
    const [treasury, treasuryBump] = await getTreasury(tokenMint);
    console.log('Mint is', mint);
    const remainingAccounts = !mint
      ? []
      : [
          {
            pubkey: new anchor.web3.PublicKey(mint),
            isWritable: false,
            isSigner: false,
          },
        ];
    await anchorProgram.rpc.initializeFairLaunch(
      fairLaunchBump,
      treasuryBump,
      tokenBump,

      {
        uuid: realUuid,
        priceRangeStart: new anchor.BN(priceRangeStartNumber),
        priceRangeEnd: new anchor.BN(priceRangeEndNumber),
        phaseOneStart: new anchor.BN(phaseOneStartDateActual),
        phaseOneEnd: new anchor.BN(phaseOneEndDateActual),
        phaseTwoEnd: new anchor.BN(phaseTwoEndDateActual),
        tickSize: new anchor.BN(tickSizeNumber),
        numberOfTokens: new anchor.BN(parsedNumber),
        fee: new anchor.BN(feeNumber),
      },
      {
        accounts: {
          fairLaunch,
          tokenMint,
          treasury,
          authority: walletKeyPair.publicKey,
          payer: walletKeyPair.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: anchor.web3.SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        },
        remainingAccounts,
        signers: [],
      },
    );

    console.log(`create fair launch Done: ${fairLaunch.toBase58()}`);
  });

program
  .command('show')
  .option(
    '-e, --env <string>',
    'Solana cluster env name',
    'devnet', //mainnet-beta, testnet, devnet
  )
  .option(
    '-k, --keypair <path>',
    `Solana wallet location`,
    '--keypair not provided',
  )
  .option('-u, --uuid <string>', 'uuid')
  .action(async (files: string[], options, cmd) => {
    const { env, uuid, keypair } = cmd.opts();
    const realUuid = uuid.slice(0, 6);

    const walletKeyPair = loadWalletKey(keypair);
    const anchorProgram = await loadFairLaunchProgram(walletKeyPair, env);
    const tokenMint = (
      await getTokenMint(walletKeyPair.publicKey, realUuid)
    )[0];
    const fairLaunch = (await getFairLaunch(tokenMint))[0];

    const fairLaunchObj = await anchorProgram.account.fairLaunch.fetch(
      fairLaunch,
    );
    console.log('Fair launch object', fairLaunchObj);
  });

program.parse(process.argv);