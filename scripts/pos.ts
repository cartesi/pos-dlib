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
import { PoS } from "../src/contracts/pos/PoS";
import { Staking } from "../src/contracts/pos/Staking";

const bre = require("@nomiclabs/buidler") as BuidlerRuntimeEnvironment;
const { deployments, ethers, getNamedAccounts } = bre;

async function main() {
    const { alice } = await getNamedAccounts();
    const PoS = await deployments.get("PoS");
    const StakingImp = await deployments.get("StakingImpl");

    const staking = (await ethers.getContractAt(
        "StakingImpl",
        StakingImp.address
    )) as Staking;
    const pos = (await ethers.getContractAt("PoS", PoS.address)) as PoS;

    console.log(`PoS: ${PoS.address}`);
    const staked = await staking.getStakedBalance(alice);
    console.log(`Staked Balance of ${alice}: ${staked}`);

    const currentIndex = await pos.currentIndex();
    console.log(`Instances: ${currentIndex}`);
    for (let i = 0; i < currentIndex.toNumber(); i++) {
        console.log(`[${i}].isConcerned = ${await pos.isConcerned(i, alice)}`);
        console.log(`[${i}].isActive = ${await pos.isActive(i)}`);
        const state = await pos.getState(i, alice);
        console.log(state);
    }
}

main()
    .then(() => process.exit(0))
    .catch(error => {
        console.error(error);
        process.exit(1);
    });
