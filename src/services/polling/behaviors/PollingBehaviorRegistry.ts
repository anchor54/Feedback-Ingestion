import { PollingBehavior } from './PollingBehavior';
import { DefaultPollingBehavior } from './DefaultPollingBehavior';
import { DiscoursePollingBehavior } from './DiscoursePollingBehavior';
import { SourceType } from '../../../common/types';

export class PollingBehaviorRegistry {
  private behaviors: PollingBehavior[] = [];
  private defaultBehavior: PollingBehavior;

  constructor() {
    this.defaultBehavior = new DefaultPollingBehavior();
    this.registerDefaultBehaviors();
  }

  /**
   * Register the default set of polling behaviors
   */
  private registerDefaultBehaviors(): void {
    this.register(new DiscoursePollingBehavior());
    // Add more source-specific behaviors here as they are implemented
  }

  /**
   * Register a new polling behavior
   * @param behavior - The polling behavior to register
   */
  register(behavior: PollingBehavior): void {
    this.behaviors.push(behavior);
    console.log(`Registered polling behavior: ${behavior.getDisplayName()}`);
  }

  /**
   * Get the appropriate polling behavior for a source type
   * @param sourceType - The source type to get behavior for
   * @returns PollingBehavior - The appropriate behavior or default if none found
   */
  getBehavior(sourceType: string): PollingBehavior {
    // Find the first behavior that can handle this source type
    const specificBehavior = this.behaviors.find(behavior => 
      behavior.canHandle(sourceType)
    );

    if (specificBehavior) {
      console.log(`Using specific behavior for ${sourceType}: ${specificBehavior.getDisplayName()}`);
      return specificBehavior;
    }

    console.log(`No specific behavior found for ${sourceType}, using default behavior`);
    return this.defaultBehavior;
  }

  /**
   * Get all registered behaviors
   * @returns PollingBehavior[] - Array of all registered behaviors
   */
  getAllBehaviors(): PollingBehavior[] {
    return [...this.behaviors, this.defaultBehavior];
  }

  /**
   * Get information about all registered behaviors
   * @returns Array of behavior info
   */
  getBehaviorInfo(): Array<{ sourceTypes: string[], displayName: string }> {
    const info = this.behaviors.map(behavior => ({
      sourceTypes: this.getSourceTypesForBehavior(behavior),
      displayName: behavior.getDisplayName()
    }));

    // Add default behavior info
    info.push({
      sourceTypes: ['*'],
      displayName: this.defaultBehavior.getDisplayName()
    });

    return info;
  }

  /**
   * Get source types that a behavior can handle (for informational purposes)
   */
  private getSourceTypesForBehavior(behavior: PollingBehavior): string[] {
    // This is a simple implementation - in a more sophisticated version,
    // behaviors could expose their supported source types
    const knownSourceTypes = [SourceType.DISCOURSE];
    return knownSourceTypes.filter(sourceType => behavior.canHandle(sourceType));
  }

  /**
   * Initialize all behaviors
   */
  async initialize(): Promise<void> {
    console.log('Initializing polling behavior registry...');
    
    for (const behavior of this.getAllBehaviors()) {
      if (behavior.initialize) {
        try {
          await behavior.initialize();
          console.log(`Initialized behavior: ${behavior.getDisplayName()}`);
        } catch (error) {
          console.error(`Failed to initialize behavior ${behavior.getDisplayName()}:`, error);
        }
      }
    }
    
    console.log('Polling behavior registry initialized');
  }

  /**
   * Cleanup all behaviors
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up polling behavior registry...');
    
    for (const behavior of this.getAllBehaviors()) {
      if (behavior.cleanup) {
        try {
          await behavior.cleanup();
          console.log(`Cleaned up behavior: ${behavior.getDisplayName()}`);
        } catch (error) {
          console.error(`Failed to cleanup behavior ${behavior.getDisplayName()}:`, error);
        }
      }
    }
    
    console.log('Polling behavior registry cleaned up');
  }
}

// Export a singleton instance
export const pollingBehaviorRegistry = new PollingBehaviorRegistry(); 