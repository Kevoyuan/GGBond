import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/files/route';
import fs from 'fs/promises';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    access: vi.fn(),
    stat: vi.fn(),
    readdir: vi.fn(),
  },
}));

// Mock process.cwd
const mockCwd = '/mock/cwd';
vi.spyOn(process, 'cwd').mockReturnValue(mockCwd);

describe('Files API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should default to current working directory if no path provided', async () => {
    // Setup request
    const req = new Request('http://localhost/api/files');

    // Setup mocks
    (fs.access as any).mockResolvedValue(undefined);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
    (fs.readdir as any).mockResolvedValue([]);

    // Execute
    const response = await GET(req);
    const data = await response.json();

    // Verify
    expect(fs.access).toHaveBeenCalledWith(mockCwd);
    expect(fs.readdir).toHaveBeenCalledWith(mockCwd, { withFileTypes: true });
    expect(response.status).toBe(200);
    expect(data.path).toBe(mockCwd);
    expect(data.files).toEqual([]);
  });

  it('should use provided path', async () => {
    const customPath = '/custom/path';
    const req = new Request(`http://localhost/api/files?path=${customPath}`);

    (fs.access as any).mockResolvedValue(undefined);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });
    (fs.readdir as any).mockResolvedValue([]);

    const response = await GET(req);
    const data = await response.json();

    expect(fs.access).toHaveBeenCalledWith(customPath);
    expect(fs.readdir).toHaveBeenCalledWith(customPath, { withFileTypes: true });
    expect(response.status).toBe(200);
    expect(data.path).toBe(customPath);
  });

  it('should return 400 if path is not a directory', async () => {
    const filePath = '/file.txt';
    const req = new Request(`http://localhost/api/files?path=${filePath}`);

    (fs.access as any).mockResolvedValue(undefined);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => false });

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Path is not a directory');
  });

  it('should return 500 if access fails', async () => {
    const protectedPath = '/protected';
    const req = new Request(`http://localhost/api/files?path=${protectedPath}`);

    (fs.access as any).mockRejectedValue(new Error('Access denied'));

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to read directory');
  });

  it('should sort directories first then files', async () => {
    const req = new Request('http://localhost/api/files');

    (fs.access as any).mockResolvedValue(undefined);
    (fs.stat as any).mockResolvedValue({ isDirectory: () => true });

    const mockEntries = [
      { name: 'file1.txt', isDirectory: () => false },
      { name: 'dir1', isDirectory: () => true },
      { name: 'file2.txt', isDirectory: () => false },
      { name: 'dir2', isDirectory: () => true },
    ];
    (fs.readdir as any).mockResolvedValue(mockEntries);

    const response = await GET(req);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.files).toHaveLength(4);

    // Sort logic verification: directories first (dir1, dir2), then files (file1.txt, file2.txt)
    expect(data.files[0].name).toBe('dir1');
    expect(data.files[1].name).toBe('dir2');
    expect(data.files[2].name).toBe('file1.txt');
    expect(data.files[3].name).toBe('file2.txt');

    // Verify structure
    expect(data.files[0].type).toBe('directory');
    expect(data.files[2].type).toBe('file');
    expect(data.files[2].extension).toBe('.txt');
  });
});
