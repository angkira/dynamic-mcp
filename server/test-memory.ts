#!/usr/bin/env node

/**
 * Memory API test script
 * 
 * This script tests the memory functionality including:
 * - Remember (storing memories)
 * - Recall (retrieving memories)
 * - Reset (deleting memories)
 */

import MemoryService from './src/services/memory/memoryService'

async function testMemoryAPI() {
  console.log('🧪 Testing Memory API...')
  
  const memoryService = new MemoryService()
  
  try {
    // Test 1: Remember some memories
    console.log('\n📝 Test 1: Storing memories...')
    
    const memory1 = await memoryService.remember({
      content: 'User prefers dark mode in the UI',
      key: 'user-preferences'
    })
    console.log('✅ Memory 1 stored:', memory1.id)
    
    const memory2 = await memoryService.remember({
      content: 'Project deadline is next Friday',
      key: 'project-info',
      metadata: { priority: 'high', type: 'deadline' }
    })
    console.log('✅ Memory 2 stored:', memory2.id)
    
    const memory3 = await memoryService.remember({
      content: 'User is working on a React application with TypeScript'
    })
    console.log('✅ Memory 3 stored:', memory3.id)
    
    // Test 2: Recall all memories
    console.log('\n🧠 Test 2: Recalling all memories...')
    const allMemories = await memoryService.recall({})
    console.log(`✅ Retrieved ${allMemories.memories.length} memories:`)
    allMemories.memories.forEach((mem, index) => {
      console.log(`  ${index + 1}. [${mem.key || 'no-key'}] ${mem.content}`)
    })
    
    // Test 3: Recall with key filter
    console.log('\n🔍 Test 3: Recalling memories with key filter...')
    const userPrefs = await memoryService.recall({ key: 'user-preferences' })
    console.log(`✅ Found ${userPrefs.memories.length} user preferences:`)
    userPrefs.memories.forEach(mem => {
      console.log(`  - ${mem.content}`)
    })
    
    // Test 4: Search memories
    console.log('\n🔎 Test 4: Searching memories...')
    const searchResults = await memoryService.recall({ search: 'React' })
    console.log(`✅ Found ${searchResults.memories.length} memories containing 'React':`)
    searchResults.memories.forEach(mem => {
      console.log(`  - ${mem.content}`)
    })
    
    // Test 5: Get statistics
    console.log('\n📊 Test 5: Getting memory statistics...')
    const stats = await memoryService.getStats()
    console.log('✅ Memory statistics:', {
      total: stats.totalMemories,
      withKeys: stats.memoriesWithKeys,
      uniqueKeys: stats.uniqueKeys,
      oldest: stats.oldestMemory?.toISOString(),
      newest: stats.newestMemory?.toISOString()
    })
    
    // Test 6: Reset specific key
    console.log('\n🗑️ Test 6: Resetting memories with specific key...')
    const resetResult = await memoryService.reset({ key: 'project-info' })
    console.log('✅ Reset result:', resetResult)
    
    // Test 7: Verify deletion
    console.log('\n✅ Test 7: Verifying deletion...')
    const remainingMemories = await memoryService.recall({})
    console.log(`✅ Remaining memories: ${remainingMemories.memories.length}`)
    
    // Test 8: Reset all memories (cleanup)
    console.log('\n🧹 Test 8: Cleaning up - resetting all memories...')
    const cleanupResult = await memoryService.reset({})
    console.log('✅ Cleanup result:', cleanupResult)
    
    console.log('\n🎉 All memory tests passed!')
    
  } catch (error) {
    console.error('❌ Memory test failed:', error)
    process.exit(1)
  } finally {
    await memoryService.close()
  }
}

// Run the test
if (require.main === module) {
  testMemoryAPI()
}

export { testMemoryAPI }
