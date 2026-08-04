import { Sequelize } from 'sequelize-typescript';
import { databaseModels } from './index';
import { ContentSubscriber } from './content-subscriber.model';
import { PatientProfile } from './patient-profile.model';
import { User } from './user.model';

/**
 * Una asociación que falta sólo se manifiesta en tiempo de ejecución, cuando
 * Sequelize lanza "X is not associated to Y" al resolver un `include`. Aquí se
 * registran los modelos sin conectar a la base para detectarlo en CI.
 */
describe('Registro de asociaciones', () => {
  beforeAll(() => {
    new Sequelize({
      dialect: 'postgres',
      models: databaseModels,
      logging: false,
    });
  });

  it('registers every model exactly once', () => {
    expect(new Set(databaseModels).size).toBe(databaseModels.length);
  });

  it('lets User include the profiles used by the admin listings', () => {
    expect(User.associations.patientProfile).toBeDefined();
    expect(User.associations.therapistProfile).toBeDefined();
    expect(User.associations.adminProfile).toBeDefined();
  });

  it('lets User include ContentSubscriber so the subscriber filter runs in SQL', () => {
    expect(User.associations.contentSubscriber).toBeDefined();
    expect(ContentSubscriber.associations.user).toBeDefined();
  });

  it('keeps the inverse side of PatientProfile', () => {
    expect(PatientProfile.associations.user).toBeDefined();
  });
});
