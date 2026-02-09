import { vi, describe, it, expect, beforeEach } from 'vitest';
import { GET } from '@/app/api/files/route';
import fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => {
  return {
    default: {
      access: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
    }
  };
});

describe('Files API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 400 if path is not a directory', async () => {
    // Mock fs.access to succeed
    vi.mocked(fs.access).mockResolvedValue(undefined);
    // Mock fs.stat to return file stats (isDirectory: false)
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => false,
    } as any);

    const req = new Request('http://localhost:3000/api/files?path=/tmp/testfile');
    const res = await GET(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('Path is not a directory');
  });

  it('should return 500 if fs.access fails', async () => {
    // Mock fs.access to fail
    vi.mocked(fs.access).mockRejectedValue(new Error('Access denied'));

    const req = new Request('http://localhost:3000/api/files?path=/tmp/testfile');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to read directory');
  });

  it('should return 500 if fs.stat fails', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    // Mock fs.stat to fail
    vi.mocked(fs.stat).mockRejectedValue(new Error('Stat failed'));

    const req = new Request('http://localhost:3000/api/files?path=/tmp/testfile');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to read directory');
  });

  it('should return 500 if fs.readdir fails', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
    } as any);
    // Mock fs.readdir to fail
    vi.mocked(fs.readdir).mockRejectedValue(new Error('Read dir failed'));

    const req = new Request('http://localhost:3000/api/files?path=/tmp/testdir');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Failed to read directory');
  });

  it('should return file list sorted with directories first', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
    } as any);

    const mockEntries = [
      { name: 'file1.txt', isDirectory: () => false },
      { name: 'dir1', isDirectory: () => true },
      { name: 'file2.txt', isDirectory: () => false },
      { name: 'dir2', isDirectory: () => true },
    ] as any;

    vi.mocked(fs.readdir).mockResolvedValue(mockEntries);

    const req = new Request('http://localhost:3000/api/files?path=/tmp/testdir');
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.path).toBe('/tmp/testdir');
    expect(data.files).toHaveLength(4);

    // Check sorting: directories first, then files
    expect(data.files[0].name).toBe('dir1');
    expect(data.files[1].name).toBe('dir2');
    expect(data.files[2].name).toBe('file1.txt');
    expect(data.files[3].name).toBe('file2.txt');

    expect(data.files[0].type).toBe('directory');
    expect(data.files[2].type).toBe('file');
    expect(data.files[2].extension).toBe('.txt');
  });

  it('should use process.cwd() if no path provided', async () => {
    vi.mocked(fs.access).mockResolvedValue(undefined);
    vi.mocked(fs.stat).mockResolvedValue({
      isDirectory: () => true,
    } as any);
    vi.mocked(fs.readdir).mockResolvedValue([]);

    const req = new Request('http://localhost:3000/api/files'); // No path param
    const res = await GET(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.path).toBe(process.cwd());
  });
});
