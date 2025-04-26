"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ArchiveProvider = void 0;
/**
 * Abstract base class for Archive Provider implementations.
 * This class defines the interface that all archive providers must implement.
 */
class ArchiveProvider {
    config;
    constructor(config) {
        this.config = config;
    }
}
exports.ArchiveProvider = ArchiveProvider;
