namespace NexusFold.Core.Rng
{
    /// <summary>
    /// xoroshiro128** — piccolo, veloce, distribuzione statisticamente adeguata al gameplay.
    /// Seed via SplitMix64 warm-up. Serializzabile via CurrentState.
    /// </summary>
    public sealed class DeterministicRng : IRng
    {
        ulong _s0, _s1;

        public DeterministicRng(ulong seed = 0x9E3779B97F4A7C15UL)
        {
            Reseed(seed);
        }

        public void Reseed(ulong seed)
        {
            _s0 = SplitMix(ref seed);
            _s1 = SplitMix(ref seed);
            if (_s0 == 0 && _s1 == 0) _s1 = 1;
        }

        public ulong CurrentState { get { return _s0 ^ (_s1 << 1); } }

        static ulong SplitMix(ref ulong x)
        {
            x += 0x9E3779B97F4A7C15UL;
            ulong z = x;
            z = (z ^ (z >> 30)) * 0xBF58476D1CE4E5B9UL;
            z = (z ^ (z >> 27)) * 0x94D049BB133111EBUL;
            return z ^ (z >> 31);
        }

        public uint NextUInt()
        {
            ulong s0 = _s0, s1 = _s1;
            ulong result = Rot(s0 * 5UL, 7) * 9UL;
            s1 ^= s0;
            _s0 = Rot(s0, 24) ^ s1 ^ (s1 << 16);
            _s1 = Rot(s1, 37);
            return (uint)(result >> 32);
        }

        static ulong Rot(ulong x, int k) { return (x << k) | (x >> (64 - k)); }

        public int Range(int minInclusive, int maxExclusive)
        {
            if (maxExclusive <= minInclusive) return minInclusive;
            uint span = (uint)(maxExclusive - minInclusive);
            return minInclusive + (int)(NextUInt() % span);
        }

        public float Value01()
        {
            // 24 bit di mantissa float → 2^24 = 16777216
            return (NextUInt() >> 8) * (1.0f / 16777216f);
        }

        public bool Chance(float p)
        {
            if (p <= 0f) return false;
            if (p >= 1f) return true;
            return Value01() < p;
        }
    }
}
