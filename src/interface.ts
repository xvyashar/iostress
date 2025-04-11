import { IOStressOptions, StressPhase } from './types';
import kleur from 'kleur';
import ora from 'ora';
import { ManagerOptions, SocketOptions } from 'socket.io-client';

export class IOStress {
  constructor(private readonly options: IOStressOptions) {}

  async run() {
    console.log('🚀 ' + kleur.bold('Starting stress test...'));

    for (const phase of this.options.phases) {
      await this.testPhase(phase);
    }
  }

  private async testPhase(phase: StressPhase) {
    console.log(`Testing phase: ${kleur.green(phase.name)}...`);

    const phaseBuildSpinner = ora('🛠️ Building phase initializers...').start();
    const initializers = await this.buildPhaseInitializers(phase).catch(
      (error) => {
        phaseBuildSpinner.fail('🛠️ Failed to build phase initializers!');
        throw error;
      },
    );
    phaseBuildSpinner.succeed('🛠️ Phase initializers built');

    // TODO: Call the task manager
  }

  private async buildPhaseInitializers(phase: StressPhase) {
    const initializers: Partial<ManagerOptions & SocketOptions>[] = [];
    const { scenarioInitializer, minClients, maxClients } = phase;

    for (let j = 0; j < (maxClients ?? minClients); j++) {
      if (scenarioInitializer) {
        initializers.push(scenarioInitializer(j));
      } else {
        initializers.push({});
      }
    }

    return initializers;
  }
}
