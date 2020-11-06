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
import { task } from "hardhat/config";
import { CartesiTokenFactory } from "@cartesi/token";
import { BigNumber } from "ethers";

task(
    "ctsi:balance",
    "Get CTSI balance of main account",
    async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers } = hre;
        const { CartesiToken } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const token = CartesiTokenFactory.connect(CartesiToken.address, signer);
        const balance = await token.balanceOf(signer.address);
        console.log(`${signer.address}: ${balance}`);
    }
);

task(
    "ctsi:drip",
    "Get CTSI from faucet in exchange of 0.3 ETH",
    async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { CtsiFaucetFactory } = await require(
            "../types/CtsiFaucetFactory"
        );
        const { deployments, ethers, run } = hre;

        // run deploy if needed
        await run("deploy");

        const { CTSIFaucet } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const faucet = CtsiFaucetFactory.connect(CTSIFaucet.address, signer);
        const drip_tx = await faucet.drip({
            value: ethers.utils.parseEther("0.3"),
        });
        console.log(`drip transaction: ${drip_tx.hash}`);
    }
);

task("ctsi:allow", "Allow spending of CTSI")
    .addPositionalParam("amount", "Amount of CTSI including 18 decimal place without '.'")
    .setAction(async (args: TaskArguments, hre: HardhatRuntimeEnvironment) => {
        const { deployments, ethers, run } = hre;

        // run deploy if needed
        await run("deploy");

        const { StakingImpl, CartesiToken } = await deployments.all();
        const [signer] = await ethers.getSigners();
        const ctsi = CartesiTokenFactory.connect(CartesiToken.address, signer);
        const approve_tx = await ctsi.approve(
            StakingImpl.address,
            BigNumber.from(args.amount)
        );
        console.log(`spending approve: ${approve_tx.hash}`);
    });
