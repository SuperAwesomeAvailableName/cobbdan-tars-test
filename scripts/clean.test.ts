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
        // Test for deleting a file
        it('should delete a file', async () => {
            // Mock the stat function to return a file stat
            const mockStat = jest.spyOn(fs.promises, 'stat').mockResolvedValue({ isFile: () => true, isDirectory: () => false } as fs.Stats)
            // Mock the unlink function to simulate successful file deletion
            const mockUnlink = jest.spyOn(fs.promises, 'unlink').mockResolvedValue()

            // Call rdelete with a test file path
            await rdelete('/test/file.txt')

            // Verify that stat and unlink were called with the correct path
            expect(mockStat).toHaveBeenCalledWith('/test/file.txt')
            expect(mockUnlink).toHaveBeenCalledWith('/test/file.txt')
        })

        // Test for deleting a directory recursively
        it('should delete a directory recursively', async () => {
            // Mock the stat function to return a directory stat
            const mockStat = jest.spyOn(fs.promises, 'stat').mockResolvedValue({ isFile: () => false, isDirectory: () => true } as fs.Stats)
            // Mock the readdir function to return a list of files in the directory
            const mockReaddir = jest.spyOn(fs.promises, 'readdir').mockResolvedValue(['file1.txt', 'file2.txt'])
            // Mock the unlink function to fail (simulating a directory)
            const mockUnlink = jest.spyOn(fs.promises, 'unlink').mockRejectedValue(new Error('Not a file'))
            // Mock the rmdir function to simulate successful directory deletion
            const mockRmdir = jest.spyOn(fs.promises, 'rmdir').mockResolvedValue()

            // Call rdelete with a test directory path
            await rdelete('/test/dir')

            // Verify that the functions were called with the correct paths and number of times
            expect(mockStat).toHaveBeenCalledWith('/test/dir')
            expect(mockReaddir).toHaveBeenCalledWith('/test/dir')
            expect(mockUnlink).toHaveBeenCalledTimes(3) // Once for the directory, twice for the files
            expect(mockRmdir).toHaveBeenCalledWith('/test/dir')
        })
    })

    describe('tryDeleteRelative', () => {
        // Test for deleting an existing path
        it('should delete an existing path', async () => {
            const mockResolve = jest.spyOn(path, 'resolve').mockReturnValue('/absolute/path')
            const mockExists = jest.spyOn(fs, 'accessSync').mockImplementation(() => {})
            const mockRdelete = jest.fn().mockResolvedValue()

            await tryDeleteRelative('relative/path')

            expect(mockResolve).toHaveBeenCalledWith(process.cwd(), 'relative/path')
            expect(mockExists).toHaveBeenCalledWith('/absolute/path')
            expect(mockRdelete).toHaveBeenCalledWith('/absolute/path')
        })

        // Test for skipping non-existent paths
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
        // Test for existing paths
        it('should return true for existing paths', () => {
            jest.spyOn(fs, 'accessSync').mockImplementation(() => {})
            expect(exists('/existing/path')).toBe(true)
        })

        // Test for non-existing paths
        it('should return false for non-existing paths', () => {
            jest.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('ENOENT') })
            expect(exists('/non-existing/path')).toBe(false)
        })
    })

    describe('getGenerated', () => {
        // Test when dist directory does not exist
        it('should return an empty array if dist directory does not exist', async () => {
            // Mock accessSync to throw an error, simulating a non-existent directory
            jest.spyOn(fs, 'accessSync').mockImplementation(() => { throw new Error('ENOENT') })
            expect(await getGenerated()).toEqual([])
        })

        // Test for reading generated files from buildinfo
        it('should return generated files from buildinfo', async () => {
            // Mock accessSync to not throw an error, simulating an existing directory
            jest.spyOn(fs, 'accessSync').mockImplementation(() => {})
            // Mock path.join to return a specific path for the buildinfo file
            jest.spyOn(path, 'join').mockReturnValue('/path/to/generated.buildinfo')
            // Mock readFile to return a JSON string containing an array of file names
            jest.spyOn(fs.promises, 'readFile').mockResolvedValue(JSON.stringify(['file1.js', 'file2.js']))

            // Expect getGenerated to return the array of file names from the buildinfo
            expect(await getGenerated()).toEqual(['file1.js', 'file2.js'])
        })

        // Test for handling invalid buildinfo file
        it('should handle invalid buildinfo file', async () => {
            // Mock accessSync to not throw an error, simulating an existing directory
            jest.spyOn(fs, 'accessSync').mockImplementation(() => {})
            // Mock path.join to return a specific path for the buildinfo file
            jest.spyOn(path, 'join').mockReturnValue('/path/to/generated.buildinfo')
            // Mock readFile to return an invalid JSON string
            jest.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json')

            // Expect getGenerated to return an empty array when the buildinfo file is invalid
            expect(await getGenerated()).toEqual([])
        })
    })
})