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

task("posV2:create", "Create the main PoS contract")
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
        "1000000000",
        types.string
    )
    .addOptionalParam(
        "diffAdjustment",
        "Specify the difficult adjustment parameter",
        "50000",
        types.string
    )
    .addOptionalParam(
        "rewardValue",
        "Reward of a block",
        "2900000000000000000000", // 2900 CTSI
        types.string
    )
    .addOptionalParam(
        "rewardDelay",
        "Blocks to wait for a reward to be claimed on V2 chains",
        "3",
        types.string
    )
    .addOptionalParam(
        "chainVersion",
        "Specify the chain version",
        "1", // v1 chain
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const {
            PoSV2FactoryImpl,
            StakingImpl,
            WorkerManagerAuthManagerImpl,
            CartesiToken,
        } = await deployments.all();
        const { PoSV2Impl__factory, PoSV2FactoryImpl__factory } =
            await require("../types");

        const [deployer] = await ethers.getSigners();

        const targetInterval = args.targetInterval;
        const minimumDiff = BigNumber.from(args.minimumDiff);
        const initialDiff = BigNumber.from(args.initialDiff);
        const diffAdjustment = BigNumber.from(args.diffAdjustment);
        const rewardValue = BigNumber.from(args.rewardValue);
        const rewardDelay = BigNumber.from(args.rewardDelay);
        const version = BigNumber.from(args.chainVersion);
        const posV2Factory = PoSV2FactoryImpl__factory.connect(
            PoSV2FactoryImpl.address,
            deployer
        );

        const pos_tx = await posV2Factory.createNewChain(
            CartesiToken.address,
            StakingImpl.address,
            WorkerManagerAuthManagerImpl.address,
            initialDiff,
            minimumDiff,
            diffAdjustment,
            targetInterval,
            rewardValue,
            rewardDelay,
            version
        );

        const pos_receipt = await pos_tx.wait(1);
        const pos_address = (
            await posV2Factory.queryFilter(
                posV2Factory.filters.NewChain(),
                pos_receipt.blockHash
            )
        )[0].args.pos;
        console.log(`PoS created at: ${pos_address}`);
        const pos = PoSV2Impl__factory.connect(pos_address, deployer);
        const rm_address = await pos.getRewardManagerAddress(0);
        console.log(
            `You need to transfer CTSI to RewardManager at ${rm_address}`
        );
    });

task("posV2:terminate", "Deativate a PoS instance")
    .addPositionalParam(
        "pos",
        "Address of pos instance to terminate",
        undefined,
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { ethers } = hre;
        const { PoSV2Impl__factory, PoSV2FactoryImpl__factory } =
            await require("../types");

        const [deployer] = await ethers.getSigners();
        const pos = PoSV2Impl__factory.connect(args.pos, deployer);

        const tx = await pos.terminate();
        console.log(`PoS terminated (txHash): ${tx.hash}`);
    });

task(
    "posV2:stake",
    "Stake some amount of CTSI including 18 decimal place without '.'"
)
    .addPositionalParam("amount", "amount of CTSI to stake")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { StakingImpl__factory } = await require("../types");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingImpl__factory.connect(
            StakingImpl.address,
            signer
        );
        const staking_tx = await staking.stake(BigNumber.from(args.amount));
        console.log(`staking_tx: ${staking_tx.hash}`);
    });

task("posV2:show", "Show staking information")
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
            IRewardManagerV2__factory,
            PoSV2Impl__factory,
            PoSV2FactoryImpl__factory,
        } = await require("../types");
        const { PoSV2FactoryImpl, StakingImpl } = await deployments.all();
        const signers = await ethers.getSigners();
        const signer = signers[args.accountIndex];
        const address = signer.address;
        const staking = StakingImpl__factory.connect(
            StakingImpl.address,
            signer
        );
        const posV2Factory = PoSV2FactoryImpl__factory.connect(
            PoSV2FactoryImpl.address,
            signer
        );

        console.log(`PoS Factory address: ${posV2Factory.address}`);
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

        const chains = await posV2Factory.queryFilter(
            posV2Factory.filters.NewChain()
        );
        const states: {
            posAddress: string;
            version: number;
            isActive: boolean;
            blockCount: number;
            canProduceBlock: boolean;
            whenCanProduceBlock: string;
            rewardManagerAddress: string;
            currentReward: string;
        }[] = [];

        for (var chain of chains) {
            const pos = PoSV2Impl__factory.connect(chain.args.pos, signer);
            const isActive = await pos.active();
            const version = chain.args.version;
            const blockCount = (await pos.getSidechainBlockCount()).toNumber();
            const canProduceBlock = await pos.canProduceBlock(address);
            const whenCanProduceBlock = await pos.whenCanProduceBlock(address);
            const rewardManagerAddress = await pos.getRewardManagerAddress(0);
            const rewardManager = await IRewardManagerV2__factory.connect(
                rewardManagerAddress,
                signer
            );
            const currentReward = await rewardManager.getCurrentReward();
            states.push({
                posAddress: pos.address,
                version,
                isActive,
                blockCount,
                canProduceBlock,
                whenCanProduceBlock: formatUnits(whenCanProduceBlock, 0),
                rewardManagerAddress,
                currentReward: formatUnits(currentReward, 18),
            });
        }

        console.log(states);
    });

task(
    "posV2:unstake",
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
    "posV2:withdraw",
    "Withdraw some amount of CTSI including 18 decimal place without '.'"
)
    .addPositionalParam("amount", "amount of CTSI")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { StakingImpl__factory } = await require("../types");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingImpl__factory.connect(
            StakingImpl.address,
            signer
        );
        const withdraw_tx = await staking.withdraw(BigNumber.from(args.amount));
        console.log(`withdraw_tx: ${withdraw_tx.hash}`);
    });

task("posV2:produceBlock", "Produce a V1 block using local node")
    .addPositionalParam(
        "pos",
        "Address of pos instance to produce",
        undefined,
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { ethers } = hre;
        const localProvider = new ethers.providers.JsonRpcProvider(
            "http://localhost:8545"
        );
        const { PoSV2Impl__factory } = await require("../types");
        const signer = localProvider.getSigner();
        const address = await signer.getAddress();
        console.log(`Producing a block using node ${address}`);

        const pos = PoSV2Impl__factory.connect(args.pos, signer);
        const tx = await pos["produceBlock(uint256)"](0);
        console.log(`tx: ${tx.hash}`);
    });
