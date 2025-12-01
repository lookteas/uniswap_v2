// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "forge-std/console.sol";

/**
 * @title UniswapV2Test
 * @notice Uniswap V2 集成测试
 */
contract UniswapV2Test is Test {
    // 合约地址
    address public weth;
    address public factory;
    address public router;
    
    // 测试账户
    address public deployer;
    address public user1;
    address public user2;
    
    // 测试代币
    address public tokenA;
    address public tokenB;
    
    function setUp() public {
        // 创建测试账户
        deployer = makeAddr("deployer");
        user1 = makeAddr("user1");
        user2 = makeAddr("user2");
        
        // 给账户分配 ETH
        vm.deal(deployer, 100 ether);
        vm.deal(user1, 100 ether);
        vm.deal(user2, 100 ether);
        
        vm.startPrank(deployer);
        
        // 1. 部署 WETH
        bytes memory wethBytecode = vm.getCode("WETH9.sol:WETH9");
        assembly {
            sstore(weth.slot, create(0, add(wethBytecode, 0x20), mload(wethBytecode)))
        }
        require(weth != address(0), "WETH deployment failed");
        console.log("WETH deployed:", weth);
        
        // 2. 部署 Factory
        bytes memory factoryBytecode = vm.getCode("v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory");
        bytes memory factoryArgs = abi.encode(deployer);
        bytes memory factoryCreationCode = abi.encodePacked(factoryBytecode, factoryArgs);
        assembly {
            sstore(factory.slot, create(0, add(factoryCreationCode, 0x20), mload(factoryCreationCode)))
        }
        require(factory != address(0), "Factory deployment failed");
        console.log("Factory deployed:", factory);
        
        // 3. 计算 init code hash
        bytes memory pairBytecode = vm.getCode("v2-core/contracts/UniswapV2Pair.sol:UniswapV2Pair");
        bytes32 initCodeHash = keccak256(pairBytecode);
        console.log("Init code hash:");
        console.logBytes32(initCodeHash);
        
        // 4. 部署 Router
        bytes memory routerBytecode = vm.getCode("v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02");
        bytes memory routerArgs = abi.encode(factory, weth);
        bytes memory routerCreationCode = abi.encodePacked(routerBytecode, routerArgs);
        assembly {
            sstore(router.slot, create(0, add(routerCreationCode, 0x20), mload(routerCreationCode)))
        }
        require(router != address(0), "Router deployment failed");
        console.log("Router deployed:", router);
        
        vm.stopPrank();
    }
    
    function test_FactoryDeployed() public view {
        assertTrue(factory != address(0), "Factory should be deployed");
        
        // 验证 feeToSetter
        (bool success, bytes memory data) = factory.staticcall(
            abi.encodeWithSignature("feeToSetter()")
        );
        assertTrue(success, "feeToSetter call should succeed");
        address feeToSetter = abi.decode(data, (address));
        assertEq(feeToSetter, deployer, "feeToSetter should be deployer");
    }
    
    function test_RouterDeployed() public view {
        assertTrue(router != address(0), "Router should be deployed");
        
        // 验证 factory
        (bool success1, bytes memory data1) = router.staticcall(
            abi.encodeWithSignature("factory()")
        );
        assertTrue(success1, "factory call should succeed");
        address routerFactory = abi.decode(data1, (address));
        assertEq(routerFactory, factory, "Router factory should match");
        
        // 验证 WETH
        (bool success2, bytes memory data2) = router.staticcall(
            abi.encodeWithSignature("WETH()")
        );
        assertTrue(success2, "WETH call should succeed");
        address routerWeth = abi.decode(data2, (address));
        assertEq(routerWeth, weth, "Router WETH should match");
    }
    
    function test_WETHDeposit() public {
        vm.startPrank(user1);
        
        uint256 depositAmount = 1 ether;
        
        // 存入 ETH
        (bool success,) = weth.call{value: depositAmount}(
            abi.encodeWithSignature("deposit()")
        );
        assertTrue(success, "Deposit should succeed");
        
        // 检查余额
        (bool success2, bytes memory data) = weth.staticcall(
            abi.encodeWithSignature("balanceOf(address)", user1)
        );
        assertTrue(success2, "balanceOf call should succeed");
        uint256 balance = abi.decode(data, (uint256));
        assertEq(balance, depositAmount, "WETH balance should match deposit");
        
        vm.stopPrank();
    }
    
    function test_InitCodeHash() public view {
        bytes memory pairBytecode = vm.getCode("v2-core/contracts/UniswapV2Pair.sol:UniswapV2Pair");
        bytes32 initCodeHash = keccak256(pairBytecode);
        
        // 原始 Uniswap V2 的 init code hash
        bytes32 originalHash = 0x96e8ac4277198ff8b6f785478aa9a39f403cb768dd02cbee326c3e7da348845f;
        
        console.log("Calculated init code hash:");
        console.logBytes32(initCodeHash);
        console.log("Original Uniswap V2 hash:");
        console.logBytes32(originalHash);
        
        // 注意：如果 hash 不同，需要更新 UniswapV2Library.sol
        if (initCodeHash != originalHash) {
            console.log("WARNING: Init code hash differs from original!");
            console.log("You need to update UniswapV2Library.sol line 24");
        }
    }
}
