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

/// @title PrizeManager
/// @author Felipe Argento


pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PrizeManager {
    using SafeMath for uint256;

    uint256 distNumerator;
    uint256 distDenominator;
    address lotteryAddress;
    IERC20 ctsi;

    event WinnerPaid(address _winner, uint256 _prize);

    constructor(
        address _lotteryAddress,
        address _ctsiAddress,
        uint256 _distNumerator,
        uint256 _distDenominator) public {

        lotteryAddress = _lotteryAddress;
        ctsi = IERC20(_ctsiAddress);

        distNumerator = _distNumerator;
        distDenominator = _distDenominator;
    }

    function payWinner(address _winner) public {
        uint256 amount = (getBalance().mul(distNumerator)).div(distDenominator);

        require(msg.sender == lotteryAddress, "Only the lottery contract can call this function");
        require(amount > 0, "Not enough money in this contract");

        ctsi.transfer(_winner, amount);

        emit WinnerPaid(_winner, amount);
    }

    function getBalance() public view returns (uint256) {
        return ctsi.balanceOf(address(this));
    }

    function getCurrentPrize() public view returns (uint256) {
        return (getBalance().mul(distNumerator)).div(distDenominator);
    }
}
