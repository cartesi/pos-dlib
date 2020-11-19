// Copyright (C) 2020 Cartesi Pte. Ltd.

// SPDX-License-Identifier: GPL-3.0-only
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

/// @title RewardManager
/// @author Felipe Argento


pragma solidity ^0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RewardManager {
    using SafeMath for uint256;

    uint256 minReward;
    uint256 maxReward;
    uint256 distNumerator;
    uint256 distDenominator;
    address operator;
    IERC20 ctsi;

    /// @notice Creates contract
    /// @param _operator address of the operator
    /// @param _ctsiAddress address of token instance being used
    /// @param _maxReward maximum reward that this contract pays
    /// @param _minReward minimum reward that this contract pays
    /// @param _distNumerator multiplier factor to define reward amount
    /// @param _distDenominator dividing factor to define reward amount
    constructor(
        address _operator,
        address _ctsiAddress,
        uint256 _maxReward,
        uint256 _minReward,
        uint256 _distNumerator,
        uint256 _distDenominator
    ) {

        operator = _operator;
        ctsi = IERC20(_ctsiAddress);

        minReward = _minReward;
        maxReward = _maxReward;
        distNumerator = _distNumerator;
        distDenominator = _distDenominator;
    }

    /// @notice Rewards address
    /// @param _address address be rewarded
    /// @param _amount reward
    /// @dev only the pos contract can call this
    function reward(address _address, uint256 _amount) public {
        require(msg.sender == operator, "Only the operator contract can call this function");

        ctsi.transfer(_address, _amount);
    }

    /// @notice Get RewardManager's balance
    function getBalance() public view returns (uint256) {
        return ctsi.balanceOf(address(this));
    }

    /// @notice Get current reward amount
    function getCurrentReward() public view returns (uint256) {
        uint256 cReward = (getBalance().mul(distNumerator)).div(distDenominator);
        cReward = cReward > minReward? cReward : minReward;
        cReward = cReward > maxReward? maxReward : cReward;

        return cReward > getBalance()? getBalance() : cReward;
    }
}
