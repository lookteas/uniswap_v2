// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title DeployUniswapV2
 * @notice 完整的 Uniswap V2 部署脚本
 * @dev 支持本地 Anvil 和 Sepolia 测试网部署
 */
contract DeployUniswapV2 is Script {
    // Sepolia 已知地址
    address constant SEPOLIA_WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
    
    // 部署结果
    address public weth;
    address public factory;
    address public router;
    bytes32 public initCodeHash;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("===========================================");
        console.log("Uniswap V2 Deployment");
        console.log("===========================================");
        console.log("Chain ID:", block.chainid);
        console.log("Deployer:", deployer);
        console.log("Balance:", deployer.balance / 1e18, "ETH");
        console.log("-------------------------------------------");
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Step 1: 部署或获取 WETH
        _deployOrGetWETH(deployer);
        
        // Step 2: 部署 Factory
        _deployFactory(deployer);
        
        // Step 3: 计算 init code hash
        _calculateInitCodeHash();
        
        // Step 4: 部署 Router
        _deployRouter();
        
        vm.stopBroadcast();
        
        // 输出部署摘要
        _printSummary();
    }
    
    function _deployOrGetWETH(address deployer) internal {
        if (block.chainid == 11155111) {
            // Sepolia - 使用已有的 WETH
            weth = SEPOLIA_WETH;
            console.log("[WETH] Using existing Sepolia WETH");
        } else {
            // 本地网络 - 部署新的 WETH
            bytes memory bytecode = vm.getCode("WETH9.sol:WETH9");
            address deployed;
            assembly {
                deployed := create(0, add(bytecode, 0x20), mload(bytecode))
            }
            require(deployed != address(0), "WETH deployment failed");
            weth = deployed;
            console.log("[WETH] Deployed new WETH");
        }
        console.log("WETH address:", weth);
    }
    
    function _deployFactory(address feeToSetter) internal {
        bytes memory bytecode = vm.getCode("v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory");
        bytes memory args = abi.encode(feeToSetter);
        bytes memory creationCode = abi.encodePacked(bytecode, args);
        
        address deployed;
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "Factory deployment failed");
        factory = deployed;
        console.log("[Factory] Deployed UniswapV2Factory");
        console.log("Factory address:", factory);
    }
    
    function _calculateInitCodeHash() internal {
        bytes memory pairBytecode = vm.getCode("v2-core/contracts/UniswapV2Pair.sol:UniswapV2Pair");
        initCodeHash = keccak256(pairBytecode);
        console.log("[InitCodeHash] Calculated pair init code hash");
    }
    
    function _deployRouter() internal {
        bytes memory bytecode = vm.getCode("v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02");
        bytes memory args = abi.encode(factory, weth);
        bytes memory creationCode = abi.encodePacked(bytecode, args);
        
        address deployed;
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "Router deployment failed");
        router = deployed;
        console.log("[Router] Deployed UniswapV2Router02");
        console.log("Router address:", router);
    }
    
    function _printSummary() internal view {
        console.log("");
        console.log("===========================================");
        console.log("DEPLOYMENT SUMMARY");
        console.log("===========================================");
        console.log("Network:", _getNetworkName());
        console.log("Chain ID:", block.chainid);
        console.log("-------------------------------------------");
        console.log("WETH:    ", weth);
        console.log("Factory: ", factory);
        console.log("Router:  ", router);
        console.log("-------------------------------------------");
        console.log("Init Code Hash:");
        console.logBytes32(initCodeHash);
        console.log("===========================================");
        console.log("");
        console.log("IMPORTANT: If the init code hash differs from");
        console.log("the hardcoded value in UniswapV2Library.sol,");
        console.log("you need to update it for Router to work correctly!");
        console.log("");
    }
    
    function _getNetworkName() internal view returns (string memory) {
        if (block.chainid == 1) return "Mainnet";
        if (block.chainid == 11155111) return "Sepolia";
        if (block.chainid == 31337) return "Anvil (Local)";
        return "Unknown";
    }
}
