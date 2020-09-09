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

import { BuidlerRuntimeEnvironment } from "@nomiclabs/buidler/types";
import { program } from "commander";
import { Staking } from "../src/types/Staking";
import { Ierc20 } from "../src/types/Ierc20";


const { advanceTime } = require("../test/utils");
const bre = require("@nomiclabs/buidler") as BuidlerRuntimeEnvironment;
const { deployments, ethers, getNamedAccounts } = bre;

async function main() {
    const STAKING_AMOUNT = 5000000;
    const DAY = 86400; // seconds in a day
    const MATURATION = 5 * DAY + 1;

    const [user] = await ethers.getSigners();
    const {StakingImpl, CartesiToken} = await deployments.all();

    const staking = (await ethers.getContractAt("StakingImpl", StakingImpl.address)) as Staking;
    const ctsi = (await ethers.getContractAt("CartesiToken", CartesiToken.address)) as Ierc20;

    // approve ctsi spending
    const approve_tx = await ctsi.approve(staking.address, STAKING_AMOUNT);

    console.log(`spending approve: ${approve_tx.hash}`);

    // deposit stake
    const deposit_transaction = await staking.depositStake(STAKING_AMOUNT);
    console.log(`Deposit transaction: ${deposit_transaction.hash}`);

    // TODO: on current deploy, MATURATION == 5 days, should be decreased for testnet
    // advancing time only works for private net

    // advance time so stake could be finalized
    await advanceTime(user.provider, MATURATION);

    // finalize stake
    const finalize_transaction = await staking.finalizeStakes();
    console.log(`Finalize stake transaction: ${finalize_transaction.hash}`);
}

