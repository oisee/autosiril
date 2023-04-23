Autosiril is a tool for converting midi to text format Vortex Tracker Improved (with the possibility to save in a format ProTracker3.4).

The tool consists of two files:

* autosiril.rb - main file
* module_template.rb - assistant file in which the template module VortexTracker'and. You can change samples in it, or any other information (note, however, that when you are converting drums, converter expects that certain types of drums must meet specific samples.)

Command line parameters for Autosiril:

ruby autosiril.rb (file.mid) (channel1),(channel2),(channel3) N1 N2 N3 N4 N5 N6 N7

Example:
ruby autosiril.rb imrav.mid 2me[2f]-6p[3]+,3m[1e]-7m[6d]-6p[3]+-2mew+,4m[3c]-5m[2b]+-2me+ 8 6 12 0 64 2 24

* autosiril.rb - The executable's name.
* (file.mid) - Path to a MIDI file made in the SMF1 format.
* (channel1),(channel2),(channel3) - Options for the instrument conversion, which will be done for the respective AY channels (left, center and right). See below for more information.
* N1 - Lines per one beat (or per one quarter of a bar). Four by default, which means that a pattern of 64 lines will consist of 4 bars; they will, in turn, have 16 lines each.
* N2 - Primary echo delay (put in lines). Three by default.
* N3 - Secondary echo delay (put in lines). Six by default.
* N4 - Length of one pattern (in lines). 64 by default, no more than 255 can be used.
* N5 - Delay before the MIDI's actual start (put in lines). Zero by default. Use this feature whenever your MIDI module starts with silence before the song begins to play.
* N6 - The ornament's positions per one chord note, which means that if you put two positions, one chord note will consume two frames in the ornament. One or two by default.
* N7 - The number of semitones from the mediant chord note. That will define the chord's "lenght", which will be used for turning it into the ornament. In case if the number of ornaments in the converted song exceeds 15, it's time to put a smaller number into this option or restructure the chords in the MIDI track manually.

* (channelN) - The options for converting MIDI channels and instruments into the text file used by Vortex Tracker Improved. There, you should list the MIDI channels' numbers, their type, mixing options and priorities. If there's more than one MIDI channel to mix, the "-" symbol is used to separate one instrument from the other, for example: 1m-2m. The priority decreases from left to right (the most important instrument goes leftmost).

Instrument types:
* d - Drums.
* m - Monophonic melody; on such an instrument, all the highest notes of the chord will be converted into plain tone notes.
* p - Polyphonic melody; on such an instrument, all the chords will be converted to ornaments.
The instrument types are listed right after the MIDI channel's number, for example: 1m, 2p or 4d.

Instrument subtypes:
* e - Envelope; used for converting the notes into envelopes, mainly used for bass sections. To be combined only with the "m" type, like this: 1me.

Instrument modifiers:
* u - Mute echo; the echo will not be generated for this instrument.
* w - Double echo; the echo will be two times longer than usual (i.e. uses both primary and secondary echo delays).
The modifiers are listed right after the instrument's type:
* 1du - The echo on the drums will be ignored.
* 2mew - The echo on the envelope will be doubled.
* 3pw - The echo on the ornaments will be doubled.

Mixing options:
* "+" - Plus - Let's say there is an instrument with lower priority, which is also marked with this symbol, and an instrument with higher priority. In case if both LP and HP have notes on the same line, the LP note will be muted out entirely. Without the "+" option, the LP note will play right after the HP note stops. Listed after the instrument modifier, like this: 1d-2me-6p+.

Options for putting certain samples and ornaments to certain channels:
* [SO] - Sample Ornament - An already existing sample or ornament in the track may be assigned to a MIDI channel before its' conversion. The square brackets indicate the numbers of sample and ornament to be used respectively. Listed after the instrument modifier, like this: 2me[2f]-6p[3]+. If the instrument is marked as polyphonic, the only thing you can change is samples; manually assigned ornaments will be ignored in that case.

You can run the following .bat/.sh files to see how it works:
* test_flim.bat
* test_imrav_hard.bat
* test_imrav_medium.bat
* test_imrav_simple.bat
* test_tottoro.bat
Those will convert the bundle MIDI files into a Vortex Tracker Improved text file.

Vortex Tracker Improved, Siril's modification of the original VTII, is also available inside the package.

P.S. Общие рекомендации по преобразованию midi в VTi:

Самым приоритетным треком в канале выбирайте ударники или бас.
Часто для ударников можно отключить эхо и звук будет лучше. "1du"
Бас интереснее конвертировать с опцией "e" (envelope). "2me"
Не стесняйтесь конвертировать с опцией "е" дорожки на разные каналы одновременно - конфликты на огибающей разрешаются автоматически.
Часто ударники и бас могут быть замиксованы в один канал, ударники приоритетнее баса. "1du-2me"
Часто в тот же канал может быть втиснута и гармония (аккорды, дорожка с опцией "p"). "1du-2me-3p"
Если миди-трек имеет BPM около 125, то первые три цифровые параметра (N1, N2, N3) могут быть 4 3 6 или 4 6 12.
Если BPM ниже или выше - имеет смысл попробовать 8 6 12 или 8 12 24 и поставить темп 3 (в VortexTracker'е).
Если размер не 4/4, а 3/4, или в MIDI-треке используется ярковыраженная синкопа, попробуйте отдать под четвёртую ноту 12 линий. то есть первые три параметра 6 0 0 или 12 0 0 (значение эха - потом подберёте).
Для миди модулей, в которых используется размер 3/4 имеет смысл задавать длину паттерна (N5) - 48 или 96 линий.
Если модуль не загружается в VTi — возможно у вас получилось слишком много паттернов или орнаментов (больше 15-ти), проверьте входные данные, уменьшите "ширину" аккордов, чтобы больше аккордов совпали и преобразовались в одинаковые орнаменты. либо оптимизируйте аккорды в секвенсоре. либо удалите "лишние" орнаменты из текста модуля — модуль загрузится, но аккорды на орнаментах нужно будет проверить и прослушать их корректность вручную, в VTi.