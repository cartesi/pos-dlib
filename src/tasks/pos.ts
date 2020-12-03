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
import { CartesiToken__factory } from "@cartesi/token";
import { formatUnits } from "ethers/lib/utils";

task("pos:create", "Create the main PoS contract")
    .addOptionalParam(
        "targetInterval",
        "Specify the desired duration of each interval, in seconds",
        10 * 60, // 10 minutes
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
        "rewardPool",
        "Specify the amount of CTSI to transfer to RewardManager",
        "50000000000000000000000000",
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { PoS__factory } = await require("../types/factories/PoS__factory");
        const {
            BlockSelector,
            PoS,
            RewardManager,
            StakingImpl,
            WorkerManagerAuthManagerImpl,
            CartesiToken,
        } = await deployments.all();

        const [deployer] = await ethers.getSigners();

        const targetInterval = args.targetInterval;
        const minimumDiff = BigNumber.from(args.minimumDiff);
        const initialDiff = BigNumber.from(args.initialDiff);
        const diffAdjustment = BigNumber.from(args.diffAdjustment);
        const pos = PoS__factory.connect(PoS.address, deployer);
        const ctsi = CartesiToken__factory.connect(
            CartesiToken.address,
            deployer
        );

        const pos_tx = await pos.instantiate(
            StakingImpl.address,
            BlockSelector.address,
            WorkerManagerAuthManagerImpl.address,
            minimumDiff,
            initialDiff,
            diffAdjustment,
            targetInterval,
            RewardManager.address
        );
        console.log(`PoS created: ${pos_tx.hash}`);

        const ctsi_tx = await ctsi.transfer(
            RewardManager.address,
            BigNumber.from(args.rewardPool)
        );
        console.log(`Transfer to RewardManager: ${ctsi_tx.hash}`);
    });

task("pos:terminate", "Deativate a PoS instance")
    .addPositionalParam(
        "index",
        "Index of instance to terminate",
        0,
        types.int
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { PoS__factory } = await require("../types/factories/PoS__factory");
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
        const { StakingImpl__factory } = await require("../types/factories/StakingImpl__factory");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingImpl__factory.connect(StakingImpl.address, signer);
        const staking_tx = await staking.stake(BigNumber.from(args.amount));
        console.log(`staking_tx: ${staking_tx.hash}`);
    });

task(
    "pos:show",
    "Show staking information",
    async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers, getNamedAccounts } = hre;
        const { StakingFactory } = await require("../types/factories/StakingImpl__factory");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingFactory.connect(StakingImpl.address, signer);

        const { alice } = await getNamedAccounts();
        const PoS = await deployments.get("PoS");

        console.log(`PoS address: ${PoS.address}`);
        const staked = await staking.getStakedBalance(alice);
        const maturing = await staking.getMaturingBalance(alice);
        const unstaked = await staking.getReleasingBalance(alice);
        const maturingTimestamp = await staking.getMaturingTimestamp(alice);
        const unstakeTimestamp = await staking.getReleasingTimestamp(alice);

        console.log(
            `Staked balance of ${alice}: ${formatUnits(staked, 18)} CTSI`
        );
        console.log(
            `Maturing balance of ${alice}: ${formatUnits(maturing, 18)} CTSI`
        );
        if (maturing.gt(0)) {
            console.log(
                `Maturation date: ${new Date(
                    maturingTimestamp.toNumber() * 1000
                )}`
            );
        }
        console.log(
            `Unstaked balance of ${alice}: ${formatUnits(unstaked, 18)} CTSI`
        );
        if (unstaked.gt(0)) {
            console.log(
                `Release date: ${new Date(unstakeTimestamp.toNumber() * 1000)}`
            );
        }
    }
);

task(
    "pos:unstake",
    "Unstake some amount of CTSI including 18 decimal place without '.'"
)
    .addPositionalParam("amount", "amount of CTSI")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const m = "../types/StakingFactory";
        const { StakingFactory } = await import(m);
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
        const { StakingImpl__factory } = await require("../types/factories/StakingImpl__factory");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingImpl__factory.connect(StakingImpl.address, signer);
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

        const { PoS__factory } = await require("../types/factories/PoS__factory");
        const { PoS } = await deployments.all();
        const pos = PoS__factory.connect(PoS.address, signer);
        const tx = await pos.produceBlock(0);
        console.log(`tx: ${tx.hash}`);
    }
);
