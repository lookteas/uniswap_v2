// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Script.sol";
import "forge-std/console.sol";

/**
 * @title DeployRouter
 * @notice 单独部署 UniswapV2Router02 的脚本
 * @dev 需要先部署 Factory，并设置 FACTORY_ADDRESS 环境变量
 */
contract DeployRouter is Script {
    // Sepolia WETH 地址
    address constant SEPOLIA_WETH = 0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9;
    
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // 获取 Factory 地址
        address factory = vm.envAddress("FACTORY_ADDRESS");
        require(factory != address(0), "FACTORY_ADDRESS not set");
        
        // 确定 WETH 地址
        address weth;
        if (block.chainid == 11155111) {
            weth = SEPOLIA_WETH;
            console.log("Using Sepolia WETH");
        } else {
            weth = vm.envAddress("WETH_ADDRESS");
            require(weth != address(0), "WETH_ADDRESS not set for local network");
        }
        
        console.log("Deploying UniswapV2Router02...");
        console.log("Deployer:", deployer);
        console.log("Factory:", factory);
        console.log("WETH:", weth);
        
        vm.startBroadcast(deployerPrivateKey);
        
        // 部署 Router
        bytes memory bytecode = vm.getCode("v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02");
        bytes memory args = abi.encode(factory, weth);
        bytes memory creationCode = abi.encodePacked(bytecode, args);
        
        address router;
        assembly {
            router := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(router != address(0), "Router deployment failed");
        
        vm.stopBroadcast();
        
        console.log("");
        console.log("========================================");
        console.log("UniswapV2Router02 deployed at:", router);
        console.log("========================================");
    }
}
