// Copyright 2020 Cartesi Pte. Ltd.

// SPDX-License-Identifier: Apache-2.0
// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";
import { formatUnits } from "ethers/lib/utils";

task("pos:create", "Create the main PoS contract")
    .addOptionalParam(
        "targetInterval",
        "Specify the desired duration of each interval, in number of blocks",
        138, // 138 blocks ~ 30 minutes on a 13s/block pace
        types.int
    )
    .addOptionalParam(
        "minimumDiff",
        "Specify the minimum difficulty parameter",
        "1000000000",
        types.string
    )
    .addOptionalParam(
        "initialDiff",
        "Specify the initial difficulty parameter",
        "100000000000000000000000000",
        types.string
    )
    .addOptionalParam(
        "diffAdjustment",
        "Specify the difficult adjustment parameter",
        "50000",
        types.string
    )
    .addOptionalParam(
        "maxReward",
        "Maximum reward of a block",
        "2900000000000000000000", // 2900 CTSI
        types.string
    )
    .addOptionalParam(
        "minReward",
        "Minimum reward of a block",
        "1000000000000000000", // 1 CTSI
        types.string
    )
    .addOptionalParam(
        "distNumerator",
        "Multiplier factor to define reward amount", // default to 0.0077%
        "77",
        types.string
    )
    .addOptionalParam(
        "distDenominator",
        "Dividing factor to define reward amount", // default to 0.0077%
        "1000000",
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const {
            PoS__factory,
        } = await require("../types/factories/PoS__factory");
        const {
            BlockSelector,
            PoS,
            StakingImpl,
            WorkerManagerAuthManagerImpl,
            CartesiToken,
        } = await deployments.all();

        const [deployer] = await ethers.getSigners();

        const targetInterval = args.targetInterval;
        const minimumDiff = BigNumber.from(args.minimumDiff);
        const initialDiff = BigNumber.from(args.initialDiff);
        const diffAdjustment = BigNumber.from(args.diffAdjustment);
        const maxReward = BigNumber.from(args.maxReward);
        const minReward = BigNumber.from(args.minReward);
        const distNumerator = BigNumber.from(args.distNumerator);
        const distDenominator = BigNumber.from(args.distDenominator);
        const pos = PoS__factory.connect(PoS.address, deployer);

        const pos_tx = await pos.instantiate(
            StakingImpl.address,
            BlockSelector.address,
            WorkerManagerAuthManagerImpl.address,
            minimumDiff,
            initialDiff,
            diffAdjustment,
            targetInterval,
            CartesiToken.address,
            maxReward,
            minReward,
            distNumerator,
            distDenominator
        );
        console.log(`PoS created: ${pos_tx.hash}`);

        await pos_tx.wait(1);
        const index = await pos.currentIndex();
        const rm_address = await pos.getRewardManagerAddress(index.sub(1));
        console.log(
            `You need to transfer CTSI to RewardManager at ${rm_address}`
        );
    });

task("pos:terminate", "Deativate a PoS instance")
    .addPositionalParam("index", "Index of instance to terminate", 0, types.int)
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const {
            PoS__factory,
        } = await require("../types/factories/PoS__factory");
        const { PoS } = await deployments.all();

        const [deployer] = await ethers.getSigners();
        const pos = PoS__factory.connect(PoS.address, deployer);

        const tx = await pos.terminate(args.index);
        console.log(`PoS terminated: ${tx.hash}`);
    });

task(
    "pos:stake",
    "Stake some amount of CTSI including 18 decimal place without '.'"
)
    .addPositionalParam("amount", "amount of CTSI to stake")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const {
            StakingImpl__factory,
        } = await require("../types/factories/StakingImpl__factory");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingImpl__factory.connect(
            StakingImpl.address,
            signer
        );
        const staking_tx = await staking.stake(BigNumber.from(args.amount));
        console.log(`staking_tx: ${staking_tx.hash}`);
    });

task("pos:show", "Show staking information")
    .addOptionalParam(
        "accountIndex",
        "Account index from MNEMONIC to use",
        0,
        types.int
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const {
            StakingImpl__factory,
        } = await require("../types/factories/StakingImpl__factory");
        const {
            PoS__factory,
        } = await require("../types/factories/PoS__factory");
        const { PoS, StakingImpl } = await deployments.all();
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const address = signer.address;
        const staking = StakingImpl__factory.connect(
            StakingImpl.address,
            signer
        );
        const pos = PoS__factory.connect(PoS.address, signer);

        console.log(`PoS address: ${PoS.address}`);
        const staked = await staking.getStakedBalance(address);
        const maturing = await staking.getMaturingBalance(address);
        const unstaked = await staking.getReleasingBalance(address);
        const maturingTimestamp = await staking.getMaturingTimestamp(address);
        const unstakeTimestamp = await staking.getReleasingTimestamp(address);

        console.log(`Account: ${address}`);
        console.log(`Staked: ${formatUnits(staked, 18)} CTSI`);
        console.log(`Maturing: ${formatUnits(maturing, 18)} CTSI`);
        if (maturing.gt(0)) {
            console.log(
                `Maturation date: ${new Date(
                    maturingTimestamp.toNumber() * 1000
                )}`
            );
        }
        console.log(`Unstaked: ${formatUnits(unstaked, 18)} CTSI`);
        if (unstaked.gt(0)) {
            console.log(
                `Release date: ${new Date(unstakeTimestamp.toNumber() * 1000)}`
            );
        }

        const count = await pos.currentIndex();
        const states = [];
        for (let i = 0; i < count.toNumber(); i++) {
            const state = await pos.getState(i, address);
            const rewardManagerAddress = await pos.getRewardManagerAddress(i);
            states.push({
                canProduceBlock: state[0],
                user: state[1],
                currentReward: state[2].toString(),
                split: state[3].toString(),
                rewardManagerAddress,
            });
        }
        console.log(states);
    });

task(
    "pos:unstake",
    "Unstake some amount of CTSI including 18 decimal place without '.'"
)
    .addPositionalParam("amount", "amount of CTSI")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { StakingFactory } = await require("../types/StakingFactory");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingFactory.connect(StakingImpl.address, signer);
        const unstaking_tx = await staking.unstake(BigNumber.from(args.amount));
        console.log(`unstaking_tx: ${unstaking_tx.hash}`);
    });

task(
    "pos:withdraw",
    "Withdraw some amount of CTSI including 18 decimal place without '.'"
)
    .addPositionalParam("amount", "amount of CTSI")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const {
            StakingImpl__factory,
        } = await require("../types/factories/StakingImpl__factory");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingImpl__factory.connect(
            StakingImpl.address,
            signer
        );
        const withdraw_tx = await staking.withdraw(BigNumber.from(args.amount));
        console.log(`withdraw_tx: ${withdraw_tx.hash}`);
    });

task("pos:produceBlock", "Produce a block using local node").setAction(
    async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const localProvider = new ethers.providers.JsonRpcProvider(
            "http://localhost:8545"
        );
        const signer = localProvider.getSigner();
        const address = await signer.getAddress();
        console.log(`Producing a block using node ${address}`);

        const {
            PoS__factory,
        } = await require("../types/factories/PoS__factory");
        const { PoS } = await deployments.all();
        const pos = PoS__factory.connect(PoS.address, signer);
        const tx = await pos.produceBlock(0);
        console.log(`tx: ${tx.hash}`);
    }
);
