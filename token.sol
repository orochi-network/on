// Sources flattened with hardhat v2.23.0 https://hardhat.org

// SPDX-License-Identifier: Apache-2.0 AND MIT

// File @openzeppelin/contracts/utils/Context.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.4) (utils/Context.sol)

pragma solidity ^0.8.0;

/**
 * @dev Provides information about the current execution context, including the
 * sender of the transaction and its data. While these are generally available
 * via msg.sender and msg.data, they should not be accessed in such a direct
 * manner, since when dealing with meta-transactions the account sending and
 * paying for execution may not be the actual sender (as far as an application
 * is concerned).
 *
 * This contract is only required for intermediate, library-like contracts.
 */
abstract contract Context {
    function _msgSender() internal view virtual returns (address) {
        return msg.sender;
    }

    function _msgData() internal view virtual returns (bytes calldata) {
        return msg.data;
    }

    function _contextSuffixLength() internal view virtual returns (uint256) {
        return 0;
    }
}


// File @openzeppelin/contracts/access/Ownable.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (access/Ownable.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module which provides a basic access control mechanism, where
 * there is an account (an owner) that can be granted exclusive access to
 * specific functions.
 *
 * By default, the owner account will be the one that deploys the contract. This
 * can later be changed with {transferOwnership}.
 *
 * This module is used through inheritance. It will make available the modifier
 * `onlyOwner`, which can be applied to your functions to restrict their use to
 * the owner.
 */
abstract contract Ownable is Context {
    address private _owner;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /**
     * @dev Initializes the contract setting the deployer as the initial owner.
     */
    constructor() {
        _transferOwnership(_msgSender());
    }

    /**
     * @dev Throws if called by any account other than the owner.
     */
    modifier onlyOwner() {
        _checkOwner();
        _;
    }

    /**
     * @dev Returns the address of the current owner.
     */
    function owner() public view virtual returns (address) {
        return _owner;
    }

    /**
     * @dev Throws if the sender is not the owner.
     */
    function _checkOwner() internal view virtual {
        require(owner() == _msgSender(), "Ownable: caller is not the owner");
    }

    /**
     * @dev Leaves the contract without owner. It will not be possible to call
     * `onlyOwner` functions. Can only be called by the current owner.
     *
     * NOTE: Renouncing ownership will leave the contract without an owner,
     * thereby disabling any functionality that is only available to the owner.
     */
    function renounceOwnership() public virtual onlyOwner {
        _transferOwnership(address(0));
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Can only be called by the current owner.
     */
    function transferOwnership(address newOwner) public virtual onlyOwner {
        require(newOwner != address(0), "Ownable: new owner is the zero address");
        _transferOwnership(newOwner);
    }

    /**
     * @dev Transfers ownership of the contract to a new account (`newOwner`).
     * Internal function without access restriction.
     */
    function _transferOwnership(address newOwner) internal virtual {
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }
}


// File @openzeppelin/contracts/token/ERC20/IERC20.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (token/ERC20/IERC20.sol)

pragma solidity ^0.8.0;

/**
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    /**
     * @dev Emitted when `value` tokens are moved from one account (`from`) to
     * another (`to`).
     *
     * Note that `value` may be zero.
     */
    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * @dev Emitted when the allowance of a `spender` for an `owner` is set by
     * a call to {approve}. `value` is the new allowance.
     */
    event Approval(address indexed owner, address indexed spender, uint256 value);

    /**
     * @dev Returns the amount of tokens in existence.
     */
    function totalSupply() external view returns (uint256);

    /**
     * @dev Returns the amount of tokens owned by `account`.
     */
    function balanceOf(address account) external view returns (uint256);

    /**
     * @dev Moves `amount` tokens from the caller's account to `to`.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transfer(address to, uint256 amount) external returns (bool);

    /**
     * @dev Returns the remaining number of tokens that `spender` will be
     * allowed to spend on behalf of `owner` through {transferFrom}. This is
     * zero by default.
     *
     * This value changes when {approve} or {transferFrom} are called.
     */
    function allowance(address owner, address spender) external view returns (uint256);

    /**
     * @dev Sets `amount` as the allowance of `spender` over the caller's tokens.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * IMPORTANT: Beware that changing an allowance with this method brings the risk
     * that someone may use both the old and the new allowance by unfortunate
     * transaction ordering. One possible solution to mitigate this race
     * condition is to first reduce the spender's allowance to 0 and set the
     * desired value afterwards:
     * https://github.com/ethereum/EIPs/issues/20#issuecomment-263524729
     *
     * Emits an {Approval} event.
     */
    function approve(address spender, uint256 amount) external returns (bool);

    /**
     * @dev Moves `amount` tokens from `from` to `to` using the
     * allowance mechanism. `amount` is then deducted from the caller's
     * allowance.
     *
     * Returns a boolean value indicating whether the operation succeeded.
     *
     * Emits a {Transfer} event.
     */
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}


// File contracts/IOrochiNetworkToken.sol

// Original license: SPDX_License_Identifier: Apache-2.0
pragma solidity 0.8.26;

interface IOrochiNetworkToken is IERC20 {
    function mint(address to, uint256 amount) external returns (bool);
}


// File @openzeppelin/contracts/security/ReentrancyGuard.sol@v4.9.6

// Original license: SPDX_License_Identifier: MIT
// OpenZeppelin Contracts (last updated v4.9.0) (security/ReentrancyGuard.sol)

pragma solidity ^0.8.0;

/**
 * @dev Contract module that helps prevent reentrant calls to a function.
 *
 * Inheriting from `ReentrancyGuard` will make the {nonReentrant} modifier
 * available, which can be applied to functions to make sure there are no nested
 * (reentrant) calls to them.
 *
 * Note that because there is a single `nonReentrant` guard, functions marked as
 * `nonReentrant` may not call one another. This can be worked around by making
 * those functions `private`, and then adding `external` `nonReentrant` entry
 * points to them.
 *
 * TIP: If you would like to learn more about reentrancy and alternative ways
 * to protect against it, check out our blog post
 * https://blog.openzeppelin.com/reentrancy-after-istanbul/[Reentrancy After Istanbul].
 */
abstract contract ReentrancyGuard {
    // Booleans are more expensive than uint256 or any type that takes up a full
    // word because each write operation emits an extra SLOAD to first read the
    // slot's contents, replace the bits taken up by the boolean, and then write
    // back. This is the compiler's defense against contract upgrades and
    // pointer aliasing, and it cannot be disabled.

    // The values being non-zero value makes deployment a bit more expensive,
    // but in exchange the refund on every call to nonReentrant will be lower in
    // amount. Since refunds are capped to a percentage of the total
    // transaction's gas, it is best to keep them low in cases like this one, to
    // increase the likelihood of the full refund coming into effect.
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;

    uint256 private _status;

    constructor() {
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     * Calling a `nonReentrant` function from another `nonReentrant`
     * function is not supported. It is possible to prevent this from happening
     * by making the `nonReentrant` function external, and making it call a
     * `private` function that does the actual work.
     */
    modifier nonReentrant() {
        _nonReentrantBefore();
        _;
        _nonReentrantAfter();
    }

    function _nonReentrantBefore() private {
        // On the first call to nonReentrant, _status will be _NOT_ENTERED
        require(_status != _ENTERED, "ReentrancyGuard: reentrant call");

        // Any calls to nonReentrant after this point will fail
        _status = _ENTERED;
    }

    function _nonReentrantAfter() private {
        // By storing the original value once again, a refund is triggered (see
        // https://eips.ethereum.org/EIPS/eip-2200)
        _status = _NOT_ENTERED;
    }

    /**
     * @dev Returns true if the reentrancy guard is currently set to "entered", which indicates there is a
     * `nonReentrant` function in the call stack.
     */
    function _reentrancyGuardEntered() internal view returns (bool) {
        return _status == _ENTERED;
    }
}


// File contracts/OrochiNetworkVesting.sol

// Original license: SPDX_License_Identifier: Apache-2.0
pragma solidity 0.8.26;



error UnableToRelease(address account, uint64 milestone, uint256 amount);
error VestingWasNotStarted(address account, uint64 timestamp, uint64 start);
error NoClaimableToken(address account, uint64 milestone);
error InsufficientBalance(address account, uint256 amount, uint256 remaining);
error InvalidVestingTerm();
error InvalidVestingSchedule(address account);
error UnableToAirdropToken(address beneficiary, uint256 amount);
error BeneficiaryAmountMismatch(uint256 beneficaryList, uint256 amountList);
error BeneficiaryAlreadyAdded(address account);
error UnableToTransfer(address beneficiaryOld, address beneficiaryNew);
error TGENotStarted();
error TGEAlreadyStarted();

/**
 * @title Orochi Network Token
 */
contract OrochiNetworkVesting is ReentrancyGuard, Ownable {
    /**
     * @dev Struct to define vesting term
     *
     */
    struct VestingTerm {
        address beneficiary;
        uint64 start;
        uint64 end;
        uint64 duration;
        uint256 unlocked;
        uint256 total;
    }

    /**
     * @dev Struct to store vesting schedule
     */
    struct VestingSchedule {
        uint64 start;
        uint64 end;
        uint64 duration;
        uint64 milestonClaimed;
        uint256 milestoneReleaseAmount;
        uint256 unlocked;
        uint256 totalClaimed;
        uint256 total;
    }

    // Token contract address
    IOrochiNetworkToken token;

    // TGE time
    uint256 private tgeTime;

    // Schedule of vesting
    mapping(address => VestingSchedule) private schedule;

    // Airdrop map for airdrop recipients
    mapping(address => uint256) private airdrop;

    // Event emitted when token is claimed
    event TokenClaimed(address account, uint64 milestone, uint256 amount);

    // Event emitted when token is unlocked at TGE
    event UnlockAtTGE(address account, uint256 amount);

    // Event emitted when airdrop is claimed
    event AirdropClaim(address account, uint256 amount);

    // Event transfer a vesting contract
    event TransferVestingContract(
        address beneficiaryOld,
        address beneficiaryNew
    );

    // Event emitted when TGE is started
    event TGEStarted();

    /**
     * @dev Modifier to make sure that the TGE is started
     */
    modifier onlyPostTGE() {
        // It's require isTGE to be true to move one
        if (_isTGE() == false) {
            revert TGENotStarted();
        }
        _;
    }

    /**
     * @dev Modifier to make sure that the TGE is not started yet
     */
    modifier onlyPreTGE() {
        // It's require isTGE to be false to move one
        if (_isTGE() == true) {
            revert TGEAlreadyStarted();
        }
        _;
    }

    /*******************************************************
     * Constructor
     ********************************************************/

    /**
     * Constructor
     * @param tokenAddress The address of the token contract
     */
    constructor(address tokenAddress, uint256 tge) {
        token = IOrochiNetworkToken(tokenAddress);
        tgeTime = tge;
    }

    /*******************************************************
     * External Post TGE
     ********************************************************/

    /**
     * Claim tokens for the sender
     * @dev Only callable after TGE
     */
    function claim() external nonReentrant onlyPostTGE {
        _claim(msg.sender);
    }

    /**
     * Claim tokens for the user from airdrop
     * @dev Only callable after TGE
     */
    function claimAirdrop() external nonReentrant onlyPostTGE {
        if (airdrop[msg.sender] > 0) {
            if (!token.mint(msg.sender, airdrop[msg.sender])) {
                revert UnableToAirdropToken(msg.sender, airdrop[msg.sender]);
            }
            emit AirdropClaim(msg.sender, airdrop[msg.sender]);
            airdrop[msg.sender] = 0;
        }
    }

    /**
     * Transfer vesting contract to new owner
     * @param beneficiaryNew New vesting contract owner
     */
    function transferVestingContract(
        address beneficiaryNew
    ) external nonReentrant {
        VestingSchedule memory vestingSchedule = schedule[msg.sender];
        if (vestingSchedule.total == 0 || schedule[beneficiaryNew].total > 0) {
            revert UnableToTransfer(msg.sender, beneficiaryNew);
        }
        // Delete old contract
        delete schedule[msg.sender];
        // Issue new contract with the same term
        schedule[beneficiaryNew] = vestingSchedule;
        emit TransferVestingContract(msg.sender, beneficiaryNew);
    }

    /*******************************************************
     * Owner Pre TGE
     ********************************************************/

    /**
     * Add users to the airdrop pool
     * @dev Only callable by the owner before TGE. Emits TGEStarted event.
     * @param beneficaryList Array of beneficiaries
     * @param amountList Array of amountList
     */
    function addUserToAirdrop(
        address[] memory beneficaryList,
        uint256[] memory amountList
    ) external nonReentrant onlyOwner onlyPreTGE {
        if (beneficaryList.length != amountList.length) {
            revert BeneficiaryAmountMismatch(
                beneficaryList.length,
                amountList.length
            );
        }
        for (uint256 i = 0; i < beneficaryList.length; i += 1) {
            airdrop[beneficaryList[i]] += amountList[i];
        }
    }

    /**
     * Add a vesting term to the contract
     * @dev Only callable by the owner before TGE
     * @param term VestingTerm struct
     */
    function addVestingTerm(
        VestingTerm calldata term
    ) external onlyOwner nonReentrant onlyPreTGE {
        // This schedule isn't empty
        if (schedule[term.beneficiary].total > 0) {
            revert BeneficiaryAlreadyAdded(term.beneficiary);
        }

        // Unlock imediatly if the total amount is already unlocked
        if (term.total == term.unlocked && term.unlocked > 0) {
            uint64 currentTimestamp = uint64(block.timestamp);

            // This schedule vested immediately
            schedule[term.beneficiary] = VestingSchedule({
                start: currentTimestamp,
                end: currentTimestamp,
                duration: 0,
                milestonClaimed: 0,
                milestoneReleaseAmount: 0,
                unlocked: term.total,
                totalClaimed: 0,
                total: term.total
            });

            emit UnlockAtTGE(term.beneficiary, term.unlocked);
            // Prevent program processing further
            return;
        }

        // Filter invalid terms
        if (
            term.total > term.unlocked &&
            term.start > block.timestamp &&
            term.duration > 0 &&
            term.end > (term.start + term.duration)
        ) {
            uint256 remaining = term.total - term.unlocked;
            uint256 milestoneTotal = (term.end - term.start) / term.duration;
            if (milestoneTotal > 0) {
                // Calculate the amount to unlock at TGE
                if (term.unlocked > 0) {
                    emit UnlockAtTGE(term.beneficiary, term.unlocked);
                }

                schedule[term.beneficiary] = VestingSchedule({
                    start: term.start,
                    end: term.end,
                    duration: term.duration,
                    milestonClaimed: 0,
                    milestoneReleaseAmount: remaining / milestoneTotal,
                    unlocked: term.unlocked,
                    totalClaimed: 0,
                    total: term.total
                });
                return;
            }
        }
        revert InvalidVestingTerm();
    }

    /*******************************************************
     * Owner post TGE
     ********************************************************/

    /**
     * Helper to claim tokens for multiple accounts at once
     * @dev Only callable by the owner after TGE
     * @param accounts Array of addresses to claim tokens for
     */
    function claimHelper(
        address[] memory accounts
    ) external nonReentrant onlyOwner onlyPostTGE {
        for (uint i = 0; i < accounts.length; i += 1) {
            _claim(accounts[i]);
        }
    }

    /*******************************************************
     * Internal
     ********************************************************/

    /**
     * Claim tokens for a single account
     * @param account Address of the account to claim tokens for
     */
    function _claim(address account) internal {
        VestingSchedule memory vestingSchedule = schedule[account];

        // If there is no token then vesting schedule is invalid
        if (vestingSchedule.total == 0) {
            revert InvalidVestingSchedule(account);
        }

        // Check if the vesting has started
        if (block.timestamp < vestingSchedule.start) {
            revert VestingWasNotStarted(
                account,
                uint64(block.timestamp),
                vestingSchedule.start
            );
        }

        (uint64 milestone, uint256 amount) = _balance(account);

        // Check if there is any claimable token left
        if (milestone > 0 && milestone == vestingSchedule.milestonClaimed) {
            revert NoClaimableToken(account, milestone);
        }

        if (
            amount == 0 ||
            amount + vestingSchedule.totalClaimed > vestingSchedule.total
        ) {
            revert InsufficientBalance(
                account,
                amount,
                vestingSchedule.total - vestingSchedule.totalClaimed
            );
        }

        // Update the vesting schedule
        vestingSchedule.milestonClaimed = milestone;
        vestingSchedule.totalClaimed += amount;
        schedule[account] = vestingSchedule;

        if (!token.mint(account, amount)) {
            revert UnableToRelease(account, milestone, amount);
        }

        emit TokenClaimed(account, milestone, amount);
    }

    /*******************************************************
     * External View
     ********************************************************/

    /**
     * Claimable token balance of the given account
     * @param account Address of the account
     */
    function balance(address account) external view returns (uint256) {
        (, uint256 amount) = _balance(account);
        return amount;
    }

    /**
     * Balance of airdrop for the given account
     * @param account Address of the account
     */
    function balanceAirdrop(address account) external view returns (uint256) {
        return airdrop[account];
    }

    /**
     * Is TGE started or not
     */
    function isTGEStarted() external view returns (bool) {
        return _isTGE();
    }

    /**
     * Get vesting schedule of the given account
     * @param account Address of the account
     */
    function getVestingSchedule(
        address account
    ) external view returns (VestingSchedule memory) {
        return schedule[account];
    }

    /*******************************************************
     * Internal View
     ********************************************************/

    /**
     * Check if TGE is happend or not
     */
    function _isTGE() internal view returns (bool) {
        return block.timestamp >= tgeTime;
    }

    /**
     * Calculate balance of the given account and milestone
     * @param account Address of the account
     * @return milestone Claimable milestone
     * @return amount Claimable amount
     */
    function _balance(
        address account
    ) internal view returns (uint64 milestone, uint256 amount) {
        VestingSchedule memory vestingSchedule = schedule[account];
        // If vesting schedule wasn't started then return 0,0
        if (block.timestamp < vestingSchedule.start) {
            return (0, 0);
        }

        // A specificed case, all token vested immediately
        if (vestingSchedule.unlocked == vestingSchedule.total) {
            // If they wasn't claim the token
            // return milestone 0 and all unlocked amount
            // otherwise return 0,0
            return
                vestingSchedule.totalClaimed > 0
                    ? (0, 0)
                    : (0, vestingSchedule.unlocked);
        }

        // Calculate total milestones
        uint64 milestoneTotal = (vestingSchedule.end - vestingSchedule.start) /
            vestingSchedule.duration;

        // If all token is vested then return remaining amount
        if (block.timestamp > vestingSchedule.end) {
            return (
                milestoneTotal,
                vestingSchedule.total - vestingSchedule.totalClaimed
            );
        }

        milestone = ((uint64(block.timestamp) - vestingSchedule.start) /
            vestingSchedule.duration);
        // Milestone can't be greater than total milestones
        milestone = milestone >= milestoneTotal ? milestoneTotal : milestone;

        // Calculate claimable milestone
        uint256 milestoneClaimable = milestone <=
            vestingSchedule.milestonClaimed
            ? 0
            : milestone - vestingSchedule.milestonClaimed;

        // If it's first claim then we include the unlocked TGE amount
        if (vestingSchedule.totalClaimed == 0 && vestingSchedule.unlocked > 0) {
            return (
                milestone,
                (milestoneClaimable * vestingSchedule.milestoneReleaseAmount) +
                    vestingSchedule.unlocked
            );
        }
        return (
            milestone,
            milestoneClaimable * vestingSchedule.milestoneReleaseAmount
        );
    }
}
