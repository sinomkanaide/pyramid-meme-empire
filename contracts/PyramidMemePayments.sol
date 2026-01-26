// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title PyramidMemeEmpire Payment Contract
 * @dev Handles all in-game purchases on Base Network using USDC
 */
contract PyramidMemePayments is Ownable, ReentrancyGuard {
    
    // USDC token on Base Network
    IERC20 public immutable USDC;
    
    // Treasury wallet for collected fees
    address public treasury;
    
    // Item prices in USDC (6 decimals)
    uint256 public constant PREMIUM_PRICE = 2_000000; // $2
    uint256 public constant BOOST_X2_PRICE = 500000; // $0.50
    uint256 public constant BOOST_X5_PRICE = 1_500000; // $1.50
    uint256 public constant ENERGY_REFILL_PRICE = 250000; // $0.25
    uint256 public constant BATTLE_PASS_PRICE = 5_000000; // $5
    
    // Player data
    struct Player {
        bool isPremium;
        uint256 boostX2Expiry;
        uint256 boostX5Expiry;
        bool hasBattlePass;
        uint256 battlePassExpiry;
        uint256 totalSpent;
    }
    
    mapping(address => Player) public players;
    
    // Events
    event PremiumPurchased(address indexed player, uint256 amount);
    event BoostPurchased(address indexed player, uint8 multiplier, uint256 amount);
    event EnergyRefilled(address indexed player, uint256 amount);
    event BattlePassPurchased(address indexed player, uint256 amount);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    
    constructor(address _usdcAddress, address _treasury) {
        require(_usdcAddress != address(0), "Invalid USDC address");
        require(_treasury != address(0), "Invalid treasury address");
        
        USDC = IERC20(_usdcAddress);
        treasury = _treasury;
    }
    
    /**
     * @dev Purchase Premium activation (permanent)
     */
    function purchasePremium() external nonReentrant {
        require(!players[msg.sender].isPremium, "Already premium");
        
        require(
            USDC.transferFrom(msg.sender, treasury, PREMIUM_PRICE),
            "USDC transfer failed"
        );
        
        players[msg.sender].isPremium = true;
        players[msg.sender].totalSpent += PREMIUM_PRICE;
        
        emit PremiumPurchased(msg.sender, PREMIUM_PRICE);
    }
    
    /**
     * @dev Purchase 2x boost (24 hours)
     */
    function purchaseBoostX2() external nonReentrant {
        require(
            USDC.transferFrom(msg.sender, treasury, BOOST_X2_PRICE),
            "USDC transfer failed"
        );
        
        players[msg.sender].boostX2Expiry = block.timestamp + 24 hours;
        players[msg.sender].totalSpent += BOOST_X2_PRICE;
        
        emit BoostPurchased(msg.sender, 2, BOOST_X2_PRICE);
    }
    
    /**
     * @dev Purchase 5x boost (24 hours)
     */
    function purchaseBoostX5() external nonReentrant {
        require(
            USDC.transferFrom(msg.sender, treasury, BOOST_X5_PRICE),
            "USDC transfer failed"
        );
        
        players[msg.sender].boostX5Expiry = block.timestamp + 24 hours;
        players[msg.sender].totalSpent += BOOST_X5_PRICE;
        
        emit BoostPurchased(msg.sender, 5, BOOST_X5_PRICE);
    }
    
    /**
     * @dev Purchase energy refill
     */
    function purchaseEnergyRefill() external nonReentrant {
        require(
            USDC.transferFrom(msg.sender, treasury, ENERGY_REFILL_PRICE),
            "USDC transfer failed"
        );
        
        players[msg.sender].totalSpent += ENERGY_REFILL_PRICE;
        
        emit EnergyRefilled(msg.sender, ENERGY_REFILL_PRICE);
    }
    
    /**
     * @dev Purchase Battle Pass (30 days)
     */
    function purchaseBattlePass() external nonReentrant {
        require(
            USDC.transferFrom(msg.sender, treasury, BATTLE_PASS_PRICE),
            "USDC transfer failed"
        );
        
        players[msg.sender].hasBattlePass = true;
        players[msg.sender].battlePassExpiry = block.timestamp + 30 days;
        players[msg.sender].totalSpent += BATTLE_PASS_PRICE;
        
        emit BattlePassPurchased(msg.sender, BATTLE_PASS_PRICE);
    }
    
    /**
     * @dev Get player data
     */
    function getPlayer(address _player) external view returns (
        bool isPremium,
        uint256 boostX2Expiry,
        uint256 boostX5Expiry,
        bool hasBattlePass,
        uint256 battlePassExpiry,
        uint256 totalSpent
    ) {
        Player memory player = players[_player];
        return (
            player.isPremium,
            player.boostX2Expiry,
            player.boostX5Expiry,
            player.hasBattlePass,
            player.battlePassExpiry,
            player.totalSpent
        );
    }
    
    /**
     * @dev Check if boosts are active
     */
    function getActiveBoosts(address _player) external view returns (
        bool hasBoostX2,
        bool hasBoostX5,
        bool hasActiveBattlePass
    ) {
        Player memory player = players[_player];
        return (
            player.boostX2Expiry > block.timestamp,
            player.boostX5Expiry > block.timestamp,
            player.hasBattlePass && player.battlePassExpiry > block.timestamp
        );
    }
    
    /**
     * @dev Update treasury address (owner only)
     */
    function updateTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid treasury address");
        address oldTreasury = treasury;
        treasury = _newTreasury;
        emit TreasuryUpdated(oldTreasury, _newTreasury);
    }
}
