import { NextResponse } from 'next/server';
import db from '@/lib/db';
import path from 'path';

export async function GET() {
  try {
    // Get file operations grouped by file_path
    const fileOps = db.prepare(`
      SELECT
        file_path,
        operation,
        COUNT(*) as count,
        MAX(created_at) as last_operation
      FROM file_ops
      WHERE created_at >= strftime('%s', 'now', '-30 days') * 1000
      GROUP BY file_path, operation
      ORDER BY count DESC
      LIMIT 100
    `).all() as Array<{
      file_path: string;
      operation: string;
      count: number;
      last_operation: number;
    }>;

    // Group by file path
    const fileMap = new Map<string, {
      read: number;
      write: number;
      edit: number;
      shell: number;
      total: number;
      lastOperation: number;
    }>();

    for (const op of fileOps) {
      const existing = fileMap.get(op.file_path) || {
        read: 0,
        write: 0,
        edit: 0,
        shell: 0,
        total: 0,
        lastOperation: 0,
      };

      const opLower = op.operation.toLowerCase();
      if (opLower.includes('read')) {
        existing.read += op.count;
      } else if (opLower.includes('write')) {
        existing.write += op.count;
      } else if (opLower.includes('edit') || opLower.includes('str_replace')) {
        existing.edit += op.count;
      } else if (opLower.includes('shell') || opLower.includes('bash')) {
        existing.shell += op.count;
      }

      existing.total += op.count;
      existing.lastOperation = Math.max(existing.lastOperation, op.last_operation);

      fileMap.set(op.file_path, existing);
    }

    // Convert to array with file name extracted
    const result = Array.from(fileMap.entries())
      .map(([filePath, data]) => ({
        filePath,
        fileName: path.basename(filePath),
        directory: path.dirname(filePath),
        ...data,
        lastOperationDate: new Date(data.lastOperation).toISOString(),
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 50); // Top 50 most operated files

    // Calculate directory-level stats for heatmap
    const dirMap = new Map<string, number>();
    for (const file of result) {
      const dir = file.directory;
      dirMap.set(dir, (dirMap.get(dir) || 0) + file.total);
    }

    const directoryHeatmap = Array.from(dirMap.entries())
      .map(([dir, count]) => ({ directory: dir, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    return NextResponse.json({
      files: result,
      directories: directoryHeatmap,
      period: '30 days',
    });
  } catch (error) {
    console.error('[file-ops] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
