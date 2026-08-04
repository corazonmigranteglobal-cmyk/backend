import { containsPattern, escapeLikePattern } from './like.util';

describe('escapeLikePattern', () => {
  it('neutralises the wildcards a user could send', () => {
    expect(escapeLikePattern('100%')).toBe('100\\%');
    expect(escapeLikePattern('a_b')).toBe('a\\_b');
    expect(escapeLikePattern('back\\slash')).toBe('back\\\\slash');
  });

  it('leaves an ordinary search term untouched', () => {
    expect(escapeLikePattern('lucía pérez')).toBe('lucía pérez');
  });
});

describe('containsPattern', () => {
  it('wraps the escaped term between wildcards', () => {
    expect(containsPattern('ansiedad')).toBe('%ansiedad%');
  });

  it('prevents a lone % from matching every row', () => {
    expect(containsPattern('%')).toBe('%\\%%');
  });
});
