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


/// @title Cartesi Staking
/// @author Felipe Argento
pragma solidity ^0.6.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import "./Staking.sol";

contract StakingImpl is Staking {
    using SafeMath for uint256;
    IERC20 private ctsi;

    uint256 timeToStake; // time it takes for deposited tokens to become staked.
    uint256 timeToWithdraw; // time it takes from witdraw signal to tokens to be unlocked.

    mapping(address => uint256) stakedBalance; // amount of money being staked.
    mapping(address => MaturationStruct) toBeStaked; // deposits waiting to be staked.
    mapping(address => MaturationStruct) toWithdraw; // money waiting for withdraw.

    struct MaturationStruct {
        uint256 amount;
        uint256 timestamp;
    }

    /// @notice constructor
    /// @param _ctsiAddress address of compatible ERC20
    /// @param _timeToStake time it takes for deposited tokens to become staked.
    /// @param _timeToWithdraw time it takes from witdraw to tokens being unlocked.
    constructor(
        address _ctsiAddress,
        uint256 _timeToStake,
        uint256 _timeToWithdraw
    ) public {
        ctsi = IERC20(_ctsiAddress);
        timeToStake = _timeToStake;
        timeToWithdraw = _timeToWithdraw;
    }

    /// @notice Deposit CTSI to be staked. The money will turn into staked
    //          balance after timeToStake days, if the function finalizeStakes
    //          is called.
    /// @param _amount The amount of tokens that are gonna be deposited.
    function depositStake(uint256 _amount) public {
        // transfer stake to contract
        // from: msg.sender
        // to: this contract
        // value: _amount
        ctsi.transferFrom(msg.sender, address(this), _amount);

        toBeStaked[msg.sender].amount = toBeStaked[msg.sender].amount.add(_amount);
        toBeStaked[msg.sender].timestamp = block.timestamp;

        emit StakeDeposited(
            toBeStaked[msg.sender].amount,
            msg.sender,
            block.timestamp + timeToStake
        );
    }

    /// @notice Transforms msg.sender mature deposits into staked tokens.
    function finalizeStakes() public {
        require(
            toBeStaked[msg.sender].amount != 0,
            "No deposits to be staked"
        );

        require(
            toBeStaked[msg.sender].timestamp.add(timeToStake) <= block.timestamp,
            "Deposits are not ready to be staked"
        );

        stakedBalance[msg.sender] = stakedBalance[msg.sender].add(toBeStaked[msg.sender].amount);
        toBeStaked[msg.sender].amount = 0;

        emit StakeFinalized(toBeStaked[msg.sender].amount, msg.sender);
    }

    /// @notice Start CTSI withdraw from staked balance process. The money will
    //          turn into withdrawal balance after timeToWithdraw days, if the
    //          function finalizeWithdraw is called.
    /// @param _amount The amount of tokens that are gonna be withdrew.
    function startWithdraw(uint256 _amount) public {
        // SafeMath.sub() will revert if _amount > stakedBalance[msg.sender]
        stakedBalance[msg.sender] = stakedBalance[msg.sender].sub(_amount);

        toWithdraw[msg.sender].amount = toWithdraw[msg.sender].amount.add(_amount);
        toWithdraw[msg.sender].timestamp = block.timestamp;

        emit WithdrawStarted(
            toWithdraw[msg.sender].amount,
            msg.sender,
            block.timestamp + timeToWithdraw
        );
    }

    /// @notice Finalizes msg.sender mature withdraws.
    function finalizeWithdraws() public {
        uint256 withdrawAmount = toWithdraw[msg.sender].amount;
        require(
            withdrawAmount != 0,
            "No withdraws to be finalized"
        );

        require(
            toWithdraw[msg.sender].timestamp.add(timeToWithdraw) <= block.timestamp,
            "Withdraw is not ready to be finalized"
        );

        toWithdraw[msg.sender].amount = 0;

        // withdraw tokens
        // from: this contract
        // to: msg.sender
        // value: bet total withdraw value on toWithdraw
        ctsi.transfer(msg.sender, withdrawAmount);
        emit WithdrawFinalized(withdrawAmount, msg.sender);
    }

    /// @notice Returns total amount of tokens counted as stake
    /// @param _userAddress user to retrieve staked balance from
    function getStakedBalance(address _userAddress)
    public
    view override
    returns (uint256) {
        return stakedBalance[_userAddress];
    }
}
