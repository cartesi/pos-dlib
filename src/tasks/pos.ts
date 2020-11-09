// Copyright (C) 2020 Cartesi Pte. Ltd.

// This program is free software: you can redistribute it and/or modify it under
// the terms of the GNU General Public License as published by the Free Software
// Foundation, either version 3 of the License, or (at your option) any later
// version.

// This program is distributed in the hope that it will be useful, but WITHOUT ANY
// WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
// PARTICULAR PURPOSE. See the GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

// Note: This component currently has dependencies that are licensed under the GNU
// GPL, version 3, and so you should treat this component as a whole as being under
// the GPL version 3. But all Cartesi-written code in this component is licensed
// under the Apache License, version 2, or a compatible permissive license, and can
// be used independently under the Apache v2 license. After this component is
// rewritten, the entire component will be released under the Apache v2 license.

import { HardhatRuntimeEnvironment, TaskArguments } from "hardhat/types";
import { task, types } from "hardhat/config";
import { BigNumber } from "ethers";
import { CartesiTokenFactory } from "@cartesi/token";
import { formatUnits } from "ethers/lib/utils";

task("pos:create", "Create the main PoS contract")
    .addOptionalParam(
        "drawInterval",
        "Specify the desired duration of each draw, in seconds",
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
        "prizePool",
        "Specify the amount of CTSI to transfer to PrizeManager",
        "50000000000000000000000000",
        types.string
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { PoSFactory } = await require("../types/PoSFactory");
        const {
            Lottery,
            PoS,
            PrizeManager,
            StakingImpl,
            WorkerAuthManagerImpl,
            CartesiToken,
        } = await deployments.all();

        const [deployer] = await ethers.getSigners();

        const drawInterval = args.drawInterval;
        const minimumDiff = BigNumber.from(args.minimumDiff);
        const initialDiff = BigNumber.from(args.initialDiff);
        const diffAdjustment = BigNumber.from(args.diffAdjustment);
        const pos = PoSFactory.connect(PoS.address, deployer);
        const ctsi = CartesiTokenFactory.connect(
            CartesiToken.address,
            deployer
        );

        const pos_tx = await pos.instantiate(
            StakingImpl.address,
            Lottery.address,
            WorkerAuthManagerImpl.address,
            minimumDiff,
            initialDiff,
            diffAdjustment,
            drawInterval,
            PrizeManager.address
        );
        console.log(`PoS created: ${pos_tx.hash}`);

        const ctsi_tx = await ctsi.transfer(
            PrizeManager.address,
            BigNumber.from(args.prizePool)
        );
        console.log(`Transfer to PrizeManager: ${ctsi_tx.hash}`);
    });

task("pos:deactivate", "Deativate a PoS instance")
    .addPositionalParam(
        "index",
        "Index of instance to deactivate",
        0,
        types.int
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { PoSFactory } = await require("../types/PoSFactory");
        const { PoS } = await deployments.all();

        const [deployer] = await ethers.getSigners();
        const pos = PoSFactory.connect(PoS.address, deployer);

        const tx = await pos.deactivate(args.index);
        console.log(`PoS deactivated: ${tx.hash}`);
    });

task("pos:stake", "Stake some amount of CTSI including 18 decimal place without '.'")
    .addPositionalParam("amount", "amount of CTSI to stake")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { StakingFactory } = await require("../types/StakingFactory");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingFactory.connect(StakingImpl.address, signer);
        const staking_tx = await staking.stake(BigNumber.from(args.amount));
        console.log(`staking_tx: ${staking_tx.hash}`);
    });

task(
    "pos:show",
    "Show staking information",
    async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers, getNamedAccounts } = hre;
        const { StakingFactory } = await require("../types/StakingFactory");
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

task("pos:unstake", "Unstake some amount of CTSI including 18 decimal place without '.'")
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

task("pos:withdraw", "Withdraw some amount of CTSI including 18 decimal place without '.'")
    .addPositionalParam("amount", "amount of CTSI")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { StakingFactory } = await require("../types/StakingFactory");
        const { StakingImpl } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const staking = StakingFactory.connect(StakingImpl.address, signer);
        const withdraw_tx = await staking.withdraw(BigNumber.from(args.amount));
        console.log(`withdraw_tx: ${withdraw_tx.hash}`);
    });

task("pos:claimWin", "Claim lottery ticket using local node")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const localProvider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
        const signer = localProvider.getSigner();
        const address = await signer.getAddress();
        console.log(`Claiming ticket using node ${address}`);

        const { PoSFactory } = await require("../types/PoSFactory");
        const { PoS } = await deployments.all();
        const pos = PoSFactory.connect(PoS.address, signer);
        const tx = await pos.claimWin(0);
        console.log(`tx: ${tx.hash}`);
    });
