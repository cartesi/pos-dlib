// Copyright 2022 Cartesi Pte. Ltd.

// Licensed under the Apache License, Version 2.0 (the "License"); you may not use
// this file except in compliance with the License. You may obtain a copy of the
// License at http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software distributed
// under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
// CONDITIONS OF ANY KIND, either express or implied. See the License for the
// specific language governing permissions and limitations under the License.

import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

const func: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
    const { deployments, getNamedAccounts } = hre;
    const { deploy } = deployments;
    const { deployer } = await getNamedAccounts();
    const { Bitmask, Difficulty, Eligibility, Tree } = await deployments.all();

    await deploy("PoSV2FactoryImpl", {
        from: deployer,
        log: true,
        libraries: {
            ["Bitmask"]: Bitmask.address,
            ["Difficulty"]: Difficulty.address,
            ["Eligibility"]: Eligibility.address,
            ["Tree"]: Tree.address,
        },
    });
};

func.tags = ["PoSV2Factory"];
func.dependencies = ["LibsV2", "LibrariesV2", "Tree"];
export default func;
