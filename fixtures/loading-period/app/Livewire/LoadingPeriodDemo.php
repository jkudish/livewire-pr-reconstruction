<?php

namespace App\Livewire;

use Livewire\Attributes\Renderless;
use Livewire\Component;

class LoadingPeriodDemo extends Component
{
    #[Renderless]
    public function fastAction(): void
    {
        usleep(100000);
        $this->dispatch('fast-finished');
    }

    #[Renderless]
    public function slowAction(): void
    {
        usleep(2000000);
        $this->dispatch('slow-finished');
    }

    public function render()
    {
        return view('livewire.loading-period-demo');
    }
}
