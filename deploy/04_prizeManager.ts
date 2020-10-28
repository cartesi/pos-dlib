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

import {
    HardhatRuntimeEnvironment,
    DeployFunction,
} from "hardhat/types";
import { BigNumber } from "ethers";

import { useOrDeploy } from "../src/helpers/useOrDeploy";

const func: DeployFunction = async (bre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = bre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();

    const { PoS } = await deployments.all();
    const CartesiTokenAddress = await useOrDeploy(
        bre,
        deployer,
        "CartesiToken"
    );
    // minutes in 6 months 26280
    // rate = 0.005% = 0.00005 = 5 / 100000
    const numerator = 5;
    const denominator = 100000;
    const minimumPrize = BigNumber.from("1000000000000000000"); // 1 ctsi
    const maxPrize = BigNumber.from("270000000000000000000"); // 270 ctsi

    await deploy("PrizeManager", {
        from: deployer,
        args: [
            PoS.address,
            CartesiTokenAddress,
            minimumPrize,
            maxPrize,
            numerator,
            denominator
        ],
        log: true
    });
};

export default func;
export const tags = ["PrizeManager"];
export const dependencies = ["PoS"];
