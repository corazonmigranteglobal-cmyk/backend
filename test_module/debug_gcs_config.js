const { getGcsForKey } = require('../src/services/gcsRegistry');

// Mock environment variables
process.env.GCP_PROJECT_ID = 'test-project';
process.env.GCS_BUCKET_NAME_PUBLIC_ASSETS = 'test-public-bucket';
process.env.GCS_PUBLIC_MODE_PUBLIC_ASSETS = 'true';

// Mock console to avoid noise
const originalConsole = console.log;

try {
    console.log('Testing public_assets configuration...');
    const gcs = getGcsForKey('public_assets');
    if (gcs.bucketName === 'test-public-bucket') {
        console.log('SUCCESS: public_assets bucket resolved correctly.');
    } else {
        console.error('FAILURE: Bucket name mismatch.', gcs.bucketName);
    }
} catch (error) {
    console.error('FAILURE: Threw error:', error.message);
}

// Test missing env var scenario
delete process.env.GCS_BUCKET_NAME_PUBLIC_ASSETS;
try {
    console.log('Testing missing env var...');
    getGcsForKey('public_assets');
    console.error('FAILURE: Should have thrown error but did not.');
} catch (error) {
    console.log('SUCCESS: Threw expected error:', error.message);
}
