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
import { BigNumber } from "ethers";
import { Staking } from "../src/contracts/pos/Staking";

const bre = require("@nomiclabs/buidler") as BuidlerRuntimeEnvironment;
const { deployments, ethers } = bre;

async function main() {
    const { StakingImpl } = await deployments.all();

    const staking = (await ethers.getContractAt(
        "StakingImpl",
        StakingImpl.address
    )) as Staking;

    const staking_tx = await staking.stake(
        BigNumber.from("100000000000000000000")
    ); // update amount
    console.log(`staking_tx: ${staking_tx.hash}`);
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
