#!/usr/bin/env node

/**
 * 测试 Naive UI 元数据提取器
 * 
 * 运行方式:
 * node test-extractor.js
 */

const { extractNaiveUIMetadata } = require('../server/out/naiveUIExtractor');

console.log('========================================');
console.log('Naive UI Metadata Extractor Test');
console.log('========================================\n');

try {
  console.log('Starting extraction...\n');
  
  const components = extractNaiveUIMetadata();
  
  if (components.length === 0) {
    console.log('⚠️  No components extracted');
    console.log('This could mean:');
    console.log('  1. naive-ui is not installed');
    console.log('  2. The package structure has changed');
    console.log('  3. There was an error during extraction\n');
    console.log('The plugin will fall back to manual metadata.\n');
    process.exit(0);
  }
  
  console.log(`✅ Successfully extracted ${components.length} components\n`);
  
  // 显示组件统计
  console.log('Components Summary:');
  console.log('-------------------');
  
  components.forEach((comp, index) => {
    console.log(`${index + 1}. ${comp.name} (${comp.tag})`);
    console.log(`   Props: ${comp.props.length}`);
    if (comp.description) {
      console.log(`   Description: ${comp.description}`);
    }
    console.log('');
  });
  
  // 详细显示前 3 个组件
  console.log('\n========================================');
  console.log('Detailed View (First 3 Components)');
  console.log('========================================\n');
  
  components.slice(0, 3).forEach(comp => {
    console.log(`Component: ${comp.name}`);
    console.log(`Tag: ${comp.tag}`);
    if (comp.description) {
      console.log(`Description: ${comp.description}`);
    }
    console.log('\nProps:');
    
    comp.props.forEach(prop => {
      console.log(`  - ${prop.name}: ${prop.type}`);
      if (prop.description) {
        console.log(`    Description: ${prop.description}`);
      }
      if (prop.required) {
        console.log(`    Required: ${prop.required}`);
      }
      if (prop.default !== undefined) {
        console.log(`    Default: ${JSON.stringify(prop.default)}`);
      }
      if (prop.options && prop.options.length > 0) {
        console.log(`    Options: ${prop.options.join(', ')}`);
      }
      console.log('');
    });
    
    console.log('-------------------\n');
  });
  
  // 检查常用组件是否存在
  console.log('========================================');
  console.log('Common Components Check');
  console.log('========================================\n');
  
  const commonComponents = [
    'n-button',
    'n-input',
    'n-select',
    'n-card',
    'n-modal',
    'n-table',
    'n-form'
  ];
  
  commonComponents.forEach(tag => {
    const found = components.find(c => c.tag === tag);
    if (found) {
      console.log(`✅ ${tag} - Found (${found.props.length} props)`);
    } else {
      console.log(`❌ ${tag} - Not found`);
    }
  });
  
  console.log('\n========================================');
  console.log('Test completed successfully!');
  console.log('========================================\n');
  
} catch (error) {
  console.error('❌ Error during extraction:');
  console.error(error);
  console.log('\nThe plugin will fall back to manual metadata.\n');
  process.exit(1);
}
