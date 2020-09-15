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
import { Staking } from "../src/contracts/pos/Staking";
import { Ierc20 } from "../src/contracts/pos/Ierc20";

const { advanceTime } = require("../test/utils");
const bre = require("@nomiclabs/buidler") as BuidlerRuntimeEnvironment;
const { deployments, ethers, getNamedAccounts } = bre;

async function main() {
    const STAKING_AMOUNT = 5000000;
    const DAY = 86400; // seconds in a day
    const MATURATION = 5 * DAY + 1;

    const [worker, user] = await ethers.getSigners();
    const userAddress = await user.getAddress();
    const { StakingImpl, CartesiToken } = await deployments.all();

    const staking = (await ethers.getContractAt(
        "StakingImpl",
        StakingImpl.address
    )) as Staking;

    const ctsi = new ethers.Contract(CartesiToken.address, CartesiToken.abi, user.provider);

    // create signed instance of contracts
    const user_ctsi = ctsi.connect(user)
    const worker_ctsi = ctsi.connect(worker)

    const user_staking = staking.connect(user)

    // transfer money to user (worker is the deployer)
    await worker_ctsi.transfer(userAddress, STAKING_AMOUNT);

    console.log("user CTSI balance: ");
    console.log(await user_ctsi.balanceOf(userAddress));

    // approve ctsi spending
    const approve_tx = await user_ctsi.approve(staking.address, STAKING_AMOUNT);

    console.log(`spending approve: ${approve_tx.hash}`);

    // deposit stake
    const deposit_transaction = await user_staking.depositStake(STAKING_AMOUNT);
    console.log(`Deposit transaction: ${deposit_transaction.hash}`);

    // TODO: on current deploy, MATURATION == 5 days, should be decreased for testnet
    // advancing time only works for private net

    // advance time so stake could be finalized
    await advanceTime(user.provider, MATURATION);

    // finalize stake
    const finalize_transaction = await user_staking.finalizeStakes();
    console.log(`Finalize stake transaction: ${finalize_transaction.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
