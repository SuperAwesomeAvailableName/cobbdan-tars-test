import * as fs from 'fs'
import * as path from 'path'
import * as util from 'util'
import { jest } from '@jest/globals'

// Mock the fs and path modules
jest.mock('fs')
jest.mock('path')

// Import the functions to test
import { rdelete, tryDeleteRelative, exists, getGenerated } from './clean'

describe('clean.ts', () => {
    beforeEach(() => {
        jest.resetAllMocks()
    })

    describe('rdelete', () => {
        it('should delete a file', async () => {
            const mockStat = jest.spyOn(fs.promises, 'stat').mockResolvedValue({ isFile: () => true, isDirectory: () => false } as fs.Stats)
            const mockUnlink = jest.spyOn(fs.promises, 'unlink').mockResolvedValue()

            await rdelete('/test/file.txt')

            expect(mockStat).toHaveBeenCalledWith('/test/file.txt')
            expect(mockUnlink).toHaveBeenCalledWith('/test/file.txt')
        })

        it('should delete a directory recursively', async () => {
            const mockStat = jest.spyOn(fs.promises, 'stat').mockResolvedValue({ isFile: () => false, isDirectory: () => true } as fs.Stats)
            const mockReaddir = jest.spyOn(fs.promises, 'readdir').mockResolvedValue(['file1.txt', 'file2.txt'])
            const mockUnlink = jest.spyOn(fs.promises, 'unlink').mockRejectedValue(new Error('Not a file'))
            const mockRmdir = jest.spyOn(fs.promises, 'rmdir').mockResolvedValue()

            await rdelete('/test/dir')

            expect(mockStat).toHaveBeenCalledWith('/test/dir')
            expect(mockReaddir).toHaveBeenCalledWith('/test/dir')
            expect(mockUnlink).toHaveBeenCalledTimes(3) // Once for the directory, twice for the files
            expect(mockRmdir).toHaveBeenCalledWith('/test/dir')
        })
    })

    describe('tryDeleteRelative', () => {
        it('should delete an existing path', async () => {
            const mockResolve = jest.spyOn(path, 'resolve').mockReturnValue('/absolute/path')
            const mockExists = jest.spyOn(fs, 'accessSync').mockImplementation(() => {})
            const mockRdelete = jest.fn().mockResolvedValue()

            await tryDeleteRelative('relative/path')

            expect(mockResolve).toHaveBeenCalledWith(process.cwd(), 'relative/path')
            expect(mockExists).toHaveBeenCalledWith('/absolute/path')
            expect(mockRdelete).toHaveBeenCalledWith('/absolute/path')
        })

        it('should skip non-existent paths', async () => {
            const mockResolve = jest.spyOn(path, 'resolve').mockReturnValue('/absolute/path')
            const mockExists = jest.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('ENOENT') })
            const mockRdelete = jest.fn()

            await tryDeleteRelative('relative/path')

            expect(mockResolve).toHaveBeenCalledWith(process.cwd(), 'relative/path')
            expect(mockExists).toHaveBeenCalledWith('/absolute/path')
            expect(mockRdelete).not.toHaveBeenCalled()
        })
    })

    describe('exists', () => {
        it('should return true for existing paths', () => {
            jest.spyOn(fs, 'accessSync').mockImplementation(() => {})
            expect(exists('/existing/path')).toBe(true)
        })

        it('should return false for non-existing paths', () => {
            jest.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('ENOENT') })
            expect(exists('/non-existing/path')).toBe(false)
        })
    })

    describe('getGenerated', () => {
        it('should return an empty array if dist directory does not exist', async () => {
            jest.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('ENOENT') })
            expect(await getGenerated()).toEqual([])
        })

        it('should return generated files from buildinfo', async () => {
            jest.spyOn(fs, 'accessSync').mockImplementation(() => {})
            jest.spyOn(path, 'join').mockReturnValue('/path/to/generated.buildinfo')
            jest.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(['file1.js', 'file2.js']))

            expect(await getGenerated()).toEqual(['file1.js', 'file2.js'])
        })

        it('should handle invalid buildinfo file', async () => {
            jest.spyOn(fs, 'accessSync').mockImplementation(() => {})
            jest.spyOn(path, 'join').mockReturnValue('/path/to/generated.buildinfo')
            jest.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json')

            expect(await getGenerated()).toEqual([])
        })
    })
})