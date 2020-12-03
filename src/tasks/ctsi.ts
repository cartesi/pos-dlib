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
import { task } from "hardhat/config";
import { CartesiToken__factory } from "@cartesi/token";
import { BigNumber } from "ethers";

task(
    "ctsi:balance",
    "Get CTSI balance of main account",
    async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { CartesiToken } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const token = CartesiToken__factory.connect(
            CartesiToken.address,
            signer
        );
        const balance = await token.balanceOf(signer.address);
        console.log(`${signer.address}: ${balance}`);
    }
);

task(
    "ctsi:drip",
    "Get CTSI from faucet in exchange of 0.3 ETH",
    async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const {
            CTSIFaucet__factory,
        } = await require("../types/factories/CTSIFaucet__factory");
        const { deployments, ethers, run } = hre;

        // run deploy if needed
        await run("deploy");

        const { CTSIFaucet } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const faucet = CTSIFaucet__factory.connect(CTSIFaucet.address, signer);
        const drip_tx = await faucet.drip({
            value: ethers.utils.parseEther("0.3"),
        });
        console.log(`drip transaction: ${drip_tx.hash}`);
    }
);

task("ctsi:allow", "Allow spending of CTSI")
    .addPositionalParam(
        "amount",
        "Amount of CTSI including 18 decimal place without '.'"
    )
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers, run } = hre;

        // run deploy if needed
        await run("deploy");

        const { StakingImpl, CartesiToken } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const ctsi = CartesiToken__factory.connect(
            CartesiToken.address,
            signer
        );
        const approve_tx = await ctsi.approve(
            StakingImpl.address,
            BigNumber.from(args.amount)
        );
        console.log(`spending approve: ${approve_tx.hash}`);
    });
