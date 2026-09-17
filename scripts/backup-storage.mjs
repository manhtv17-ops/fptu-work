import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs/promises'
import path from 'node:path'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
const outputRoot = process.env.BACKUP_STORAGE_DIR || 'backup/storage'

if (!url || !serviceRole) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false }
})

const safeSegment = value => String(value || '').replace(/[\\/:*?"<>|]/g, '_')
const ensureDir = dir => fs.mkdir(dir, { recursive: true })

async function listAllObjects(bucketId, prefix = '') {
  const objects = []
  const queue = [prefix]

  while (queue.length) {
    const currentPrefix = queue.shift()
    let offset = 0

    while (true) {
      const { data, error } = await supabase.storage
        .from(bucketId)
        .list(currentPrefix, {
          limit: 1000,
          offset,
          sortBy: { column: 'name', order: 'asc' }
        })

      if (error) throw error
      if (!data?.length) break

      for (const item of data) {
        const fullPath = currentPrefix ? `${currentPrefix}/${item.name}` : item.name
        if (item.id) objects.push(fullPath)
        else queue.push(fullPath)
      }

      if (data.length < 1000) break
      offset += data.length
    }
  }

  return objects
}

async function downloadObject(bucketId, objectPath) {
  const { data, error } = await supabase.storage.from(bucketId).download(objectPath)
  if (error) throw error

  const target = path.join(
    outputRoot,
    safeSegment(bucketId),
    ...objectPath.split('/').map(safeSegment)
  )

  await ensureDir(path.dirname(target))
  const arrayBuffer = await data.arrayBuffer()
  await fs.writeFile(target, Buffer.from(arrayBuffer))
}

await ensureDir(outputRoot)

const { data: buckets, error: bucketError } = await supabase.storage.listBuckets()
if (bucketError) throw bucketError

const manifest = { generated_at: new Date().toISOString(), buckets: [] }

for (const bucket of buckets || []) {
  console.log(`Backing up bucket: ${bucket.name}`)
  const objectPaths = await listAllObjects(bucket.id)
  let downloaded = 0
  const failures = []

  for (const objectPath of objectPaths) {
    try {
      await downloadObject(bucket.id, objectPath)
      downloaded += 1
      console.log(`  OK ${objectPath}`)
    } catch (error) {
      failures.push({ path: objectPath, error: error?.message || String(error) })
      console.error(`  FAIL ${objectPath}:`, error?.message || error)
    }
  }

  manifest.buckets.push({
    id: bucket.id,
    name: bucket.name,
    public: bucket.public,
    total_objects: objectPaths.length,
    downloaded,
    failures
  })
}

await fs.writeFile(
  path.join(outputRoot, 'storage-manifest.json'),
  JSON.stringify(manifest, null, 2)
)

const failed = manifest.buckets.reduce((sum, bucket) => sum + bucket.failures.length, 0)
if (failed) throw new Error(`Storage backup failed for ${failed} object(s)`)
console.log('Supabase Storage backup completed successfully')
