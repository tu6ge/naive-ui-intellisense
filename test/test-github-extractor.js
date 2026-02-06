#!/usr/bin/env node

/**
 * 测试从 GitHub 提取 Naive UI 组件元数据
 * 
 * 运行方式:
 * node test-github-extractor.js
 */

const { extractFromGithub } = require('../server/out/githubExtractor');

console.log('========================================');
console.log('GitHub Metadata Extractor Test');
console.log('========================================\n');

async function test() {
  try {
    console.log('Starting extraction from GitHub...\n');
    console.log('This may take a while as it fetches from GitHub API...\n');
    
    const components = await extractFromGithub();
    
    if (components.length === 0) {
      console.log('⚠️  No components extracted');
      console.log('Possible reasons:');
      console.log('  1. Network connection issue');
      console.log('  2. GitHub API rate limit');
      console.log('  3. Repository structure changed');
      console.log('\nThe plugin will fall back to manual metadata.\n');
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
        console.log(`   Description: ${comp.description.substring(0, 60)}...`);
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
      
      if (comp.props.length === 0) {
        console.log('  (No props found - may need manual review)');
      } else {
        comp.props.slice(0, 5).forEach(prop => {
          console.log(`  - ${prop.name}: ${prop.type}`);
          if (prop.description) {
            console.log(`    ${prop.description}`);
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
        
        if (comp.props.length > 5) {
          console.log(`  ... and ${comp.props.length - 5} more props`);
        }
      }
      
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
      'n-form',
      'n-data-table',
      'n-dropdown',
      'n-menu'
    ];
    
    commonComponents.forEach(tag => {
      const found = components.find(c => c.tag === tag);
      if (found) {
        console.log(`✅ ${tag} - Found (${found.props.length} props)`);
      } else {
        console.log(`❌ ${tag} - Not found (will use manual metadata if available)`);
      }
    });
    
    // 显示缓存信息
    console.log('\n========================================');
    console.log('Cache Information');
    console.log('========================================\n');
    console.log('Extracted data has been cached locally.');
    console.log('Next time the extraction will be much faster.');
    console.log('Cache will be refreshed every 24 hours.');
    
    console.log('\n========================================');
    console.log('Test completed successfully!');
    console.log('========================================\n');
    
    // 显示使用提示
    console.log('💡 Tips:');
    console.log('  - Components are cached for 24 hours');
    console.log('  - If extraction fails, plugin uses manual metadata');
    console.log('  - Check cache directory: server/.cache/naive-ui-docs/');
    console.log('');
    
  } catch (error) {
    console.error('❌ Error during extraction:');
    console.error(error);
    console.log('\nThe plugin will fall back to manual metadata.\n');
    process.exit(1);
  }
}

test();
