import { RedisArchiveProvider, RedisArchiveProviderConfig, setupRedisSchema } from "../src/archiveProviders/RedisArchiveProvider/RedisArchiveProvider";
import { createClient, RedisClientType } from 'redis';
import { config } from 'dotenv';
import { ArchiveEntry } from "../packages/recall/src/archiveProviders/types";

// Load environment variables
config();

const client = createClient({
  url: 'redis://localhost:6380',
}) as RedisClientType;

// Sample animal data with rich descriptions
const animals = [
  {
    name: 'Bald Eagle',
    content: `The Bald Eagle is a majestic bird of prey native to North America.
    Physical characteristics: Large wingspan, distinctive white head and dark brown body, powerful hooked beak.
    Movement: Flying - Expert flyer capable of soaring at high altitudes and diving at high speeds.
    Habitat: North America, particularly near coastal areas, lakes, and rivers.
    Diet: Carnivorous, primarily hunting fish but also small mammals and birds.
    Behavior: Territorial birds, mate for life, build large nests in tall trees.
    Conservation status: Successfully recovered from endangered status.`
  },
  {
    name: 'Kangaroo',
    content: `The Kangaroo is an iconic marsupial native to Australia.
    Physical characteristics: Powerful hind legs, long tail for balance, distinctive hopping movement.
    Movement: Walking/Hopping - Uses unique bipedal hopping for efficient movement.
    Habitat: Australia's grasslands and open woodlands.
    Diet: Herbivorous, feeding primarily on grass and other vegetation.
    Behavior: Social animals living in groups called mobs, females carry young in pouches.
    Conservation status: Generally stable populations.`
  },
  {
    name: 'Lion',
    content: `The Lion is known as the king of beasts, native to Africa.
    Physical characteristics: Muscular build, males with distinctive manes, powerful jaws.
    Movement: Walking - Stealthy movement for hunting and patrolling territory.
    Habitat: African savannas and grasslands.
    Diet: Carnivorous hunter, preying on large mammals like zebras and wildebeest.
    Behavior: Social cats living in prides, cooperative hunting strategies.
    Conservation status: Vulnerable due to habitat loss and human conflict.`
  },
  {
    name: 'Panda',
    content: `The Giant Panda is a beloved bear species native to central China.
    Physical characteristics: Distinctive black and white coloring, round body, specialized wrist bone for handling bamboo.
    Movement: Walking - Adapted for climbing and moving through bamboo forests.
    Habitat: Mountain forests of central China.
    Diet: Herbivorous, specializing in bamboo consumption.
    Behavior: Solitary animals, spending most time eating and resting.
    Conservation status: Vulnerable but recovering through conservation efforts.`
  },
  {
    name: 'Penguin',
    content: `The Penguin is a flightless bird perfectly adapted to life in Antarctica.
    Physical characteristics: Streamlined body, waterproof feathers, flipper-like wings.
    Movement: Walking/Swimming - Waddling on land but extremely agile in water.
    Habitat: Antarctica's frozen coastlines and waters.
    Diet: Carnivorous, feeding on fish, squid, and krill.
    Behavior: Highly social, forming large colonies for survival and breeding.
    Conservation status: Varies by species, many threatened by climate change.`
  },
  {
    name: 'Red Fox',
    content: `The Red Fox is a highly adaptable canid found throughout Europe.
    Physical characteristics: Reddish-orange fur, white-tipped tail, pointed ears.
    Movement: Walking - Agile and quick, capable of pouncing on prey.
    Habitat: European forests, grasslands, and urban areas.
    Diet: Carnivorous hunter, feeding on small mammals, birds, and insects.
    Behavior: Generally solitary, excellent problem-solving abilities.
    Conservation status: Least concern, highly successful species.`
  },
  {
    name: 'Hummingbird',
    content: `The Hummingbird is a tiny, remarkable bird native to North America.
    Physical characteristics: Tiny size, iridescent feathers, long beak for nectar feeding.
    Movement: Flying - Unique ability to hover and fly backwards.
    Habitat: North American gardens, forests, and meadows.
    Diet: Nectar from flowers, supplemented with small insects.
    Behavior: Solitary, extremely high metabolism requiring frequent feeding.
    Conservation status: Varies by species, some threatened by habitat loss.`
  },
  {
    name: 'Elephant',
    content: `The African Elephant is Earth's largest land mammal.
    Physical characteristics: Large ears, long trunk, impressive tusks.
    Movement: Walking - Steady, powerful movement capable of covering long distances.
    Habitat: African savannas, forests, and deserts.
    Diet: Herbivorous, consuming large amounts of vegetation daily.
    Behavior: Highly social, living in matriarchal herds with complex social bonds.
    Conservation status: Vulnerable due to poaching and habitat loss.`
  },
  {
    name: 'Polar Bear',
    content: `The Polar Bear is the Arctic's largest predator.
    Physical characteristics: White fur, large size, powerful build.
    Movement: Walking - Adapted for moving across ice and swimming in cold waters.
    Habitat: Arctic regions, primarily on sea ice.
    Diet: Carnivorous hunter, primarily hunting seals.
    Behavior: Solitary except during breeding, excellent swimmers.
    Conservation status: Vulnerable due to climate change impacts on sea ice.`
  },
  {
    name: 'Macaw',
    content: `The Macaw is a colorful parrot native to South America.
    Physical characteristics: Bright plumage, large curved beak, long tail.
    Movement: Flying - Strong flyers with excellent maneuverability.
    Habitat: South American rainforests.
    Diet: Omnivorous, eating fruits, nuts, and seeds.
    Behavior: Highly intelligent, social birds that mate for life.
    Conservation status: Many species endangered due to habitat loss and pet trade.`
  },
  {
    name: 'Cheetah',
    content: `The Cheetah is the fastest land animal.
    Physical characteristics: Slender build, spotted coat, small head.
    Movement: Walking/Running - Capable of incredible sprinting speeds.
    Habitat: African savannas and grasslands.
    Diet: Carnivorous hunter, primarily hunting medium-sized antelopes.
    Behavior: Solitary or small groups, known for short high-speed chases.
    Conservation status: Vulnerable due to habitat loss and human conflict.`
  },
  {
    name: 'Koala',
    content: `The Koala is a unique marsupial native to Australia.
    Physical characteristics: Round body, large nose, specialized hands for climbing.
    Movement: Walking - Adapted for tree climbing and arboreal life.
    Habitat: Australian eucalyptus forests.
    Diet: Herbivorous, specializing in eucalyptus leaves.
    Behavior: Solitary, spending most time sleeping and eating.
    Conservation status: Vulnerable due to habitat loss and disease.`
  },
  {
    name: 'Golden Eagle',
    content: `The Golden Eagle is one of Europe's largest birds of prey.
    Physical characteristics: Dark brown plumage, golden nape, powerful talons.
    Movement: Flying - Excellent soaring ability and aerial maneuverability.
    Habitat: European mountains and open landscapes.
    Diet: Carnivorous, hunting small to medium-sized mammals and birds.
    Behavior: Territorial, mate for life, build large nests on cliffs.
    Conservation status: Least concern but protected in many areas.`
  },
  {
    name: 'Giraffe',
    content: `The Giraffe is the world's tallest land animal.
    Physical characteristics: Long neck, distinctive spotted pattern, long legs.
    Movement: Walking - Unique gait moving both legs on one side together.
    Habitat: African savannas and woodlands.
    Diet: Herbivorous, feeding on leaves, fruits, and branches.
    Behavior: Social animals living in loose groups.
    Conservation status: Vulnerable due to habitat fragmentation.`
  },
  {
    name: 'Snow Leopard',
    content: `The Snow Leopard is a mysterious big cat of Asian mountains.
    Physical characteristics: Thick fur, long tail, camouflaged coat pattern.
    Movement: Walking - Excellent climbers in rocky terrain.
    Habitat: High mountain ranges of Central and South Asia.
    Diet: Carnivorous hunter, preying on mountain goats and sheep.
    Behavior: Solitary and elusive, well adapted to cold environments.
    Conservation status: Vulnerable due to poaching and habitat loss.`
  },
  {
    name: 'Albatross',
    content: `The Albatross is a master of oceanic flight.
    Physical characteristics: Enormous wingspan, hooked beak, efficient gliding ability.
    Movement: Flying - Capable of flying for hours without flapping wings.
    Habitat: Southern oceans around Antarctica.
    Diet: Carnivorous, feeding on squid, fish, and krill.
    Behavior: Spends most life at sea, returns to land only for breeding.
    Conservation status: Many species threatened by fishing practices.`
  },
  {
    name: 'Bison',
    content: `The American Bison is North America's largest land mammal.
    Physical characteristics: Massive head, shoulder hump, thick fur.
    Movement: Walking - Powerful movement across grasslands.
    Habitat: North American prairies and plains.
    Diet: Herbivorous, grazing primarily on grasses and sedges.
    Behavior: Social animals living in herds.
    Conservation status: Near threatened, recovering from near extinction.`
  },
  {
    name: 'Jaguar',
    content: `The Jaguar is the largest cat native to the Americas.
    Physical characteristics: Muscular build, rosette-patterned coat, powerful bite force.
    Movement: Walking - Stealthy movement through various terrains.
    Habitat: South American rainforests and wetlands.
    Diet: Carnivorous hunter, capable of taking large prey.
    Behavior: Solitary, excellent swimmers, primarily nocturnal.
    Conservation status: Near threatened due to habitat fragmentation.`
  },
  {
    name: 'Emu',
    content: `The Emu is a large flightless bird native to Australia.
    Physical characteristics: Tall stature, long neck, shaggy feathers.
    Movement: Walking - Fast runners with powerful legs.
    Habitat: Australian grasslands and woodlands.
    Diet: Herbivorous, eating seeds, fruits, and vegetation.
    Behavior: Nomadic, following food sources across large areas.
    Conservation status: Least concern with stable populations.`
  },
  {
    name: 'Barn Owl',
    content: `The Barn Owl is a widespread nocturnal bird of prey.
    Physical characteristics: Heart-shaped face, pale coloration, silent flight.
    Movement: Flying - Specialized feathers for silent flight.
    Habitat: European farmlands and woodlands.
    Diet: Carnivorous, primarily hunting small mammals.
    Behavior: Nocturnal hunters with excellent hearing.
    Conservation status: Least concern but declining in some regions.`
  }
];

async function seedAnimals() {
  await client.connect();
  console.log('Connected to Redis');

  // Set up Redis schema and initialize provider
  const config: RedisArchiveProviderConfig = {
    client,
    indexName: 'idx:archive',
    collectionName: 'recall:memory:archive:',
    embeddingModel: 'text-embedding-3-small',
    dimensions: 1536 // text-embedding-3-small dimension size
  };

  try {
    // Set up schema
    await setupRedisSchema(
      client,
      config.indexName,
      config.collectionName,
      config.dimensions
    );
    console.log('Redis schema setup complete');

    const provider = new RedisArchiveProvider(config);

    // Get initial count
    const initialCount = await provider.count();
    console.log(`Initial entry count: ${initialCount}`);

    // Clear existing entries
    if (initialCount > 0) {
      await provider.clear();
      console.log('Cleared existing entries');
    }

    // Process all animals in parallel
    console.log(`Seeding ${animals.length} animal entries...`);
    const results = await Promise.all(animals.map(async (animal) => {
      try {
        const entry = {
          name: animal.name,
          content: animal.content,
          metadata: JSON.stringify({})
        };

        await provider.addEntry(entry);
        return { success: true, name: animal.name };
      } catch (error) {
        console.error(`Failed to add entry for ${animal.name}:`, error);
        return { success: false, name: animal.name, error };
      }
    }));

    // Report results
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    const finalCount = await provider.count();

    console.log('\nSeeding complete:');
    console.log(`- Successfully added: ${successful} entries`);
    console.log(`- Failed to add: ${failed} entries`);
    console.log(`- Final entry count: ${finalCount}`);

  } catch (error) {
    console.error('Failed to seed animals:', error);
    throw error;
  } finally {
    await client.disconnect();
    console.log('\nDisconnected from Redis');
  }
}

console.log('Starting animal seeding process...');
seedAnimals().catch(error => {
  console.error('Seeding failed:', error);
  process.exit(1);
}); 
