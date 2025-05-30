<?php

namespace Database\Factories;

use App\Models\Song;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

class InteractionFactory extends Factory
{
    /** @return array<mixed> */
    public function definition(): array
    {
        return [
            'song_id' => Song::factory(),
            'user_id' => User::factory(),
            'liked' => $this->faker->boolean(),
            'play_count' => $this->faker->randomNumber(),
        ];
    }
}
